import { z } from 'zod'
import { isPrismaTransactionConflict, prisma } from '~/prisma/index'
import { deleteKunToken } from '~/app/api/utils/jwt'
import { deleteResource } from '../resource/delete'
import { invalidatePatchResourceDetailCache } from '~/app/api/patch/resource/cache'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import {
  invalidatePatchContentCache,
  invalidatePatchContentCacheByPatchId
} from '~/app/api/patch/cache'
import { recomputePatchRatingStats } from '~/app/api/patch/rating/stat'
import { invalidateTagListCache } from '~/app/api/tag/cache'
import { invalidateCompanyListCache } from '~/app/api/company/cache'
import { invalidatePatchCommentCache } from '~/app/api/patch/comment/cache'
import { recalcPatchType } from '~/app/api/patch/resource/_helper'
import {
  enqueueSearchOutbox,
  kickSearchOutboxDrain
} from '~/server/search/sync'

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
  // 资源详情缓存装 status=0 的全部 section, 资源列表只列 section='patch',
  // 故两个计数各驱动一个失效
  const publicAnySectionResourceCount = await prisma.patch_resource.count({
    where: {
      user_id: input.uid,
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
  let affectedUniqueIds: string[] = []
  let ratingAffectedPatchIds: number[] = []
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

          // 覆盖式赋值: Serializable 重试时不累加 (与 affectedUniqueIds 同理)
          const ratingPatchIds = ratedPatches
            .filter(
              (rating) =>
                rating.status === 0 && rating.patch.user_id !== input.uid
            )
            .map((rating) => rating.patch_id)
          await recomputePatchRatingStats(ratingPatchIds, prisma)
          ratingAffectedPatchIds = ratingPatchIds

          // 级联删除已移除资源行但不触发聚合重算, 补齐之
          // (patch 内容缓存失效已移出事务, 由提交后统一失效; 与 create/update/delete/hidden 一致)
          // 事务性入队与重算同循环：与补丁变更原子提交，关闭崩溃丢失窗口
          // 局部数组每次 attempt 重建并覆盖式赋值, 使 Serializable 重试不累加脏条目
          const uniqueIds: string[] = []
          for (const patchId of affectedPatchIds) {
            uniqueIds.push(await recalcPatchType(patchId, prisma))
            await enqueueSearchOutbox(prisma, patchId)
          }
          affectedUniqueIds = uniqueIds

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
  if (publicAnySectionResourceCount > 0) {
    await invalidatePatchResourceDetailCache()
  }
  if (publicResourceCount > 0) {
    await invalidateResourceListCache()
  }
  await Promise.all(
    commentedPatches.map((c) => invalidatePatchCommentCache(c.patch_id))
  )
  // 事务提交后失效: 事务内失效会被并发读回填旧值 (M-04), 且 Redis 故障不应回滚写入
  await Promise.all(
    affectedUniqueIds.map((uniqueId) =>
      invalidatePatchContentCache(uniqueId).catch(() => undefined)
    )
  )
  // 级联删除的公开评论/评分改 _count.comment 与 ratingSummary, 失效对应 patch 详情缓存 (M-05)
  await invalidatePatchContentCacheByPatchId([
    ...commentedPatches.map((c) => c.patch_id),
    ...ratingAffectedPatchIds
  ]).catch(() => undefined)
  // 事务内已逐 id 入队，此处一次 kick 触发 drain 处理整箱（避免逐 id 各 kick）
  kickSearchOutboxDrain()

  return result
}
