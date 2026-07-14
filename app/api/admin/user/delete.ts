import { z } from 'zod'
import { isPrismaTransactionConflict, prisma } from '~/prisma/index'
import { deleteKunToken } from '~/app/api/utils/jwt'
import { deleteResource } from '../resource/delete'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import { recomputePatchRatingStats } from '~/app/api/patch/rating/stat'
import { invalidateTagListCache } from '~/app/api/tag/cache'
import { invalidateCompanyListCache } from '~/app/api/company/cache'
import { invalidatePatchCommentCache } from '~/app/api/patch/comment/cache'
import { recalcPatchType } from '~/app/api/patch/resource/_helper'
import { queueSearchSync } from '~/server/search/sync'

const userIdSchema = z.object({
  uid: z.coerce.number({ message: '用户 ID 必须为数字' }).min(1).max(9999999)
})

export const deleteUser = async (
  input: z.infer<typeof userIdSchema>,
  uid: number
) => {
  const user = await prisma.user.findUnique({
    where: { id: input.uid },
    select: { id: true, name: true, email: true, role: true, status: true }
  })
  if (!user) {
    return '未找到用户'
  }
  if (input.uid === uid) {
    return '请勿删除自己'
  }

  const admin = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, name: true }
  })
  if (!admin) {
    return '未找到管理员'
  }

  const patchResourceS3Ids = await prisma.patch_resource.findMany({
    where: {
      user_id: input.uid,
      links: {
        some: {
          storage: 's3'
        }
      }
    },
    select: { id: true }
  })
  const resourceIds = patchResourceS3Ids.map((s) => s.id)
  const publicResourceCount = await prisma.patch_resource.count({
    where: {
      user_id: input.uid,
      section: 'patch',
      status: 0
    }
  })
  // 删除前收集该用户 status=0 评论涉及的 patch, 级联删除后逐个失效评论缓存
  const commentedPatches = await prisma.patch_comment.findMany({
    where: { user_id: input.uid, status: 0 },
    select: { patch_id: true },
    distinct: ['patch_id']
  })

  if (resourceIds.length) {
    for (const res of resourceIds) {
      await deleteResource({ resourceId: res }, uid)
    }
  }

  let result: Record<string, never>
  let affectedPatchIds: number[] = []
  let retryCount = 0
  while (true) {
    try {
      result = await prisma.$transaction(
        async (prisma) => {
          // Serializable 使「读取受影响 patch → 级联删除 → 重算」成为同一数据库快照;
          // 并发新增评价或 status 迁移会使其中一个事务回滚, 不会提交漏算结果
          const ratedPatches = await prisma.patch_rating.findMany({
            where: { user_id: input.uid },
            select: {
              patch_id: true,
              status: true,
              patch: { select: { user_id: true } }
            }
          })

          // 该用户在他人补丁下的资源随 user.delete() 级联消失, 但 patch 的
          // type/language/platform 聚合不会自动重算. S3 资源已由上方 deleteResource
          // 各自重算, 此处 Serializable 快照只读到剩余的非 S3 资源 (漏算集);
          // 自己的 patch 会被级联删故过滤掉. 排序固定通告锁序, 与 hidden.ts 同理避免死锁
          const resourcePatches = await prisma.patch_resource.findMany({
            where: {
              user_id: input.uid,
              patch: { user_id: { not: input.uid } }
            },
            select: { patch_id: true },
            distinct: ['patch_id']
          })
          affectedPatchIds = resourcePatches
            .map((resource) => resource.patch_id)
            .sort((a, b) => a - b)

          await prisma.user.delete({
            where: { id: input.uid }
          })

          await recomputePatchRatingStats(
            ratedPatches
              .filter(
                (rating) =>
                  rating.status === 0 && rating.patch.user_id !== input.uid
              )
              .map((rating) => rating.patch_id),
            prisma
          )

          // 级联删除已移除资源行但不触发聚合重算, 补齐之
          // (recalcPatchType 内含 patch 内容缓存失效, 与 create/update/delete/hidden 一致)
          for (const patchId of affectedPatchIds) {
            await recalcPatchType(patchId, prisma)
          }

          await prisma.admin_log.create({
            data: {
              type: 'delete',
              user_id: uid,
              content: `管理员 ${admin.name} 删除了一个用户\n\n${JSON.stringify(user)}`
            }
          })

          return {}
        },
        { timeout: 60000, isolationLevel: 'Serializable' }
      )
      break
    } catch (error) {
      if (!isPrismaTransactionConflict(error) || retryCount >= 2) {
        throw error
      }
      retryCount++
    }
  }

  await Promise.all([invalidateTagListCache(), invalidateCompanyListCache()])
  await deleteKunToken(input.uid)
  if (publicResourceCount > 0) {
    await invalidateResourceListCache()
  }
  await Promise.all(
    commentedPatches.map((c) => invalidatePatchCommentCache(c.patch_id))
  )
  for (const patchId of affectedPatchIds) {
    queueSearchSync(patchId)
  }

  return result
}
