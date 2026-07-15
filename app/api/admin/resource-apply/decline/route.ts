import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { createMessage } from '~/app/api/utils/message'
import { kunParsePutBody } from '~/app/api/utils/parseQuery'
import { declinePatchResourceSchema } from '~/validations/admin'
import {
  enqueueResourceLinkDeletions,
  recalcPatchType
} from '~/app/api/patch/resource/_helper'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'
import { invalidateUserPendingResourceCache } from '~/app/api/utils/pendingResourceCache'
import { queueSearchSync, enqueueSearchOutbox } from '~/server/search/sync'
import { kickS3DeletionDrain } from '~/server/storage/s3Outbox'

const declinePatchResource = async (
  input: z.infer<typeof declinePatchResourceSchema>,
  adminUid: number
) => {
  const { resourceId, reason } = input

  const resource = await prisma.patch_resource.findUnique({
    where: { id: resourceId },
    include: {
      user: true,
      patch: { select: { name: true, unique_id: true } },
      links: true
    }
  })
  if (!resource) {
    return '该资源不存在'
  }

  const admin = await prisma.user.findUnique({ where: { id: adminUid } })
  if (!admin) {
    return '管理员不存在'
  }

  const s3Links = resource.links.filter((link) => link.storage === 's3')

  const response = await prisma.$transaction(async (prisma) => {
    await prisma.patch_resource.delete({
      where: { id: resourceId }
    })
    await recalcPatchType(resource.patch_id, prisma)
    // 事务性入队：与补丁变更原子提交，关闭崩溃丢失窗口
    await enqueueSearchOutbox(prisma, resource.patch_id)
    // 事务性入队 S3 删除：与行删除原子提交，取代提交后 Promise.all 的不可恢复删除
    await enqueueResourceLinkDeletions(
      prisma,
      s3Links.map((link) => ({
        content: link.content,
        patchId: resource.patch_id,
        hash: link.hash,
        s3Key: link.s3_key
      }))
    )

    await createMessage({
      type: 'system',
      content: `您上传的资源「${resource.name || resource.patch.name}」未通过审核，原因：${reason}`,
      recipient_id: resource.user_id,
      link: `/${resource.patch.unique_id}?tab=resources&resourceSection=${resource.section}`
    })

    await prisma.admin_log.create({
      data: {
        type: 'decline',
        user_id: adminUid,
        content: `管理员 ${admin.name} 拒绝了一条资源\n\n拒绝原因:${reason}\nGalgame 名称:${resource.patch.name}\n资源 ID:${resource.id}\n资源标题:${resource.name}\n上传用户:${resource.user.name}`
      }
    })

    return {}
  })

  queueSearchSync(resource.patch_id)
  // 事务提交后失效: 事务内失效会被并发读回填旧值 (M-04), 且 Redis 故障不应回滚写入
  await invalidatePatchContentCache(resource.patch.unique_id).catch(
    () => undefined
  )

  if (resource.section === 'patch' && resource.status === 0) {
    await invalidateResourceListCache()
  }

  // 拒绝即删除待审资源: 作者 hasPendingResource 可能翻假, 失效以尽早停止 bypass
  await invalidateUserPendingResourceCache(resource.user_id)

  // 即时消费删除出箱；抢不到锁则由定时任务兜底
  kickS3DeletionDrain()

  return response
}

export const PUT = async (req: NextRequest) => {
  const input = await kunParsePutBody(req, declinePatchResourceSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('未登录')
  }
  if (payload.role < 4) {
    return NextResponse.json('仅超级管理员可访问')
  }

  const response = await declinePatchResource(input, payload.uid)
  return NextResponse.json(response)
}
