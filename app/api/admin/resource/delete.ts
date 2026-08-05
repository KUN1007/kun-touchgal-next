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
  const patchResource = await prisma.patch_resource.findUnique({
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
  if (!patchResource) {
    return '未找到对应的资源'
  }

  const s3Links = patchResource.links.filter((link) => link.storage === 's3')

  let affectedUniqueId = ''
  const response = await prisma.$transaction(async (prisma) => {
    await cleanupResourceCommentDerivatives(prisma, input.resourceId)
    await prisma.patch_resource.delete({
      where: { id: input.resourceId }
    })
    await deletePendingModerationTasks('resource', input.resourceId, prisma)
    await deletePendingAppeals('resource', input.resourceId, prisma)
    affectedUniqueId = await recalcPatchType(patchResource.patch_id, prisma)
    // 事务性入队：与补丁变更原子提交，关闭崩溃丢失窗口
    await enqueueSearchOutbox(prisma, patchResource.patch_id)
    // 事务性入队 S3 删除：与行删除原子提交，取代提交后 Promise.all 的不可恢复删除
    await enqueueResourceLinkDeletions(
      prisma,
      s3Links.map((link) => ({
        content: link.content,
        patchId: patchResource.patch_id,
        hash: link.hash,
        s3Key: link.s3_key
      }))
    )

    const sanitizedResource = {
      ...patchResource,
      links: sanitizeResourceLinksForAuditLog(patchResource.links)
    }
    await prisma.admin_log.create({
      data: {
        type: 'delete',
        user_id: uid,
        content: `管理员 ${admin.name} 删除了一个资源\n\nGalgame 名:\n${patchResource.patch.name}\n\n资源信息:\n${JSON.stringify(sanitizedResource)}`
      }
    })

    return {}
  })

  queueSearchSync(patchResource.patch_id)
  // 事务提交后失效: 事务内失效会被并发读回填旧值 (M-04), 且 Redis 故障不应回滚写入
  await invalidatePatchContentCache(affectedUniqueId).catch(() => undefined)

  if (patchResource.status === 0) {
    await invalidatePatchResourceDetailCache()
    if (patchResource.section === 'patch') {
      await invalidateResourceListCache()
    }
  }

  // 删除待审核 (2/3) 资源: 作者 hasPendingResource 可能翻假, 失效以尽早停止 bypass
  if (patchResource.status === 2 || patchResource.status === 3) {
    await invalidateUserPendingResourceCache(patchResource.user_id)
  }

  // 即时消费删除出箱；抢不到锁则由定时任务兜底
  kickS3DeletionDrain()

  return response
}
