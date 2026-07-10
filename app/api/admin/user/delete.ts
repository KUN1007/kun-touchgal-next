import { z } from 'zod'
import { isPrismaTransactionConflict, prisma } from '~/prisma/index'
import { deleteKunToken } from '~/app/api/utils/jwt'
import { deleteResource } from '../resource/delete'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import { recomputePatchRatingStats } from '~/app/api/patch/rating/stat'

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

  if (resourceIds.length) {
    for (const res of resourceIds) {
      await deleteResource({ resourceId: res }, uid)
    }
  }

  let result: Record<string, never>
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

  await deleteKunToken(input.uid)
  if (publicResourceCount > 0) {
    await invalidateResourceListCache()
  }

  return result
}
