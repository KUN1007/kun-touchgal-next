import { z } from 'zod'
import { prisma } from '~/prisma/index'
import {
  cleanupResourceCommentDerivatives,
  enqueueResourceLinkDeletions,
  recalcPatchType,
  sanitizeResourceLinksForAuditLog
} from '~/app/api/patch/resource/_helper'
import { invalidatePatchResourceDetailCache } from '~/app/api/patch/resource/cache'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'
import { invalidateUserPendingResourceCache } from '~/app/api/utils/pendingResourceCache'
import { deletePendingModerationTasks } from '~/server/moderation/submit'
import { deletePendingAppeals } from '~/server/moderation/appeal'
import { deleteOrphanReports } from '~/server/report/pending'
import { queueSearchSync, enqueueSearchOutbox } from '~/server/search/sync'
import { kickS3DeletionDrain } from '~/server/storage/s3Outbox'

const resourceIdSchema = z.object({
  resourceId: z.coerce
    .number({ message: '资源 ID 必须为数字' })
    .min(1)
    .max(9999999)
})

export const deleteResource = async (
  input: z.infer<typeof resourceIdSchema>,
  uid: number
) => {
  const admin = await prisma.user.findUnique({ where: { id: uid } })
  if (!admin) {
    return '未找到该管理员'
  }
  // 事务外预检仅做快速失败; links 与审计快照不从这里取 —— 快照与事务之间的并发
  // 编辑会重绑 s3 对象, 入队与审计的事实源必须是锁下重读的删除瞬间状态
  const patchResource = await prisma.patch_resource.findUnique({
    where: { id: input.resourceId }
  })
  if (!patchResource) {
    return '未找到对应的资源'
  }

  let affectedUniqueId = ''
  const deleteResult = await prisma.$transaction(async (prisma) => {
    // 行锁先行: 与 update / moderation apply 的 FOR UPDATE 互斥, 锁序 (先
    // patch_resource) 与其一致
    const [locked] = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM patch_resource WHERE id = ${input.resourceId} FOR UPDATE`
    // 此处尚无任何写入, return 业务错误仅提交空事务, 零副作用
    if (!locked) {
      return '未找到对应的资源'
    }
    // 锁下重读行 + links + patch 名: S3 入队与审计日志都以删除瞬间状态为准
    const current = await prisma.patch_resource.findUnique({
      where: { id: input.resourceId },
      include: {
        patch: {
          select: {
            name: true
          }
        },
        links: true
      }
    })
    // FOR UPDATE 命中即行存在, 同事务内必能读到; 条件仅为类型收窄
    if (!current) {
      return '未找到对应的资源'
    }
    const s3Links = current.links.filter((link) => link.storage === 's3')

    await cleanupResourceCommentDerivatives(prisma, input.resourceId)
    // 提交后的失效闸门读这里的返回值而非事务外快照: 快照与删除之间的并发 approve
    // (2→0) 或隐藏 (0→1) 会让闸门误判该行删除时是否在 status=0 集合里
    const deleted = await prisma.patch_resource.delete({
      where: { id: input.resourceId }
    })
    await deletePendingModerationTasks('resource', input.resourceId, prisma)
    await deletePendingAppeals('resource', input.resourceId, prisma)
    await deleteOrphanReports('comment', prisma)
    affectedUniqueId = await recalcPatchType(current.patch_id, prisma)
    // 事务性入队：与补丁变更原子提交，关闭崩溃丢失窗口
    await enqueueSearchOutbox(prisma, current.patch_id)
    // 事务性入队 S3 删除：与行删除原子提交，取代提交后 Promise.all 的不可恢复删除
    await enqueueResourceLinkDeletions(
      prisma,
      s3Links.map((link) => ({
        content: link.content,
        patchId: current.patch_id,
        hash: link.hash,
        s3Key: link.s3_key
      }))
    )

    const sanitizedResource = {
      ...current,
      links: sanitizeResourceLinksForAuditLog(current.links)
    }
    await prisma.admin_log.create({
      data: {
        type: 'delete',
        user_id: uid,
        content: `管理员 ${admin.name} 删除了一个资源\n\nGalgame 名:\n${current.patch.name}\n\n资源信息:\n${JSON.stringify(sanitizedResource)}`
      }
    })

    return deleted
  })
  if (typeof deleteResult === 'string') {
    return deleteResult
  }
  const deletedResource = deleteResult

  queueSearchSync(patchResource.patch_id)
  // 事务提交后失效: 事务内失效会被并发读回填旧值 (M-04), 且 Redis 故障不应回滚写入
  await invalidatePatchContentCache(affectedUniqueId).catch(() => undefined)

  if (deletedResource.status === 0) {
    await invalidatePatchResourceDetailCache(patchResource.patch_id)
    if (deletedResource.section === 'patch') {
      await invalidateResourceListCache()
    }
  }

  // 删除待审核 (2/3) 资源: 作者 hasPendingResource 可能翻假, 失效以尽早停止 bypass
  if (deletedResource.status === 2 || deletedResource.status === 3) {
    await invalidateUserPendingResourceCache(deletedResource.user_id)
  }

  // 即时消费删除出箱；抢不到锁则由定时任务兜底
  kickS3DeletionDrain()

  return {}
}
