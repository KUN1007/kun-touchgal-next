import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { deleteKunToken } from '~/app/api/utils/jwt'
import { deleteResource } from '../resource/delete'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import { recomputePatchRatingStat } from '~/app/api/patch/rating/stat'

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
  // 删除用户会级联移除其评价 (onDelete: Cascade), 提前记录受影响的 patch;
  // 仅 status=0 的评价计入 patch_rating_stat, 其余状态删除后统计不变
  const ratedPatches = await prisma.patch_rating.findMany({
    where: { user_id: input.uid, status: 0 },
    select: { patch_id: true },
    distinct: ['patch_id']
  })

  const result = await prisma.$transaction(
    async (prisma) => {
      if (resourceIds.length) {
        for (const res of resourceIds) {
          await deleteResource({ resourceId: res }, uid)
        }
      }

      await prisma.user.delete({
        where: { id: input.uid }
      })

      await prisma.admin_log.create({
        data: {
          type: 'delete',
          user_id: uid,
          content: `管理员 ${admin.name} 删除了一个用户\n\n${JSON.stringify(user)}`
        }
      })

      return {}
    },
    { timeout: 60000 }
  )

  // recomputePatchRatingStat 内部自开事务, 须在删除事务提交后调用
  for (const { patch_id } of ratedPatches) {
    await recomputePatchRatingStat(patch_id)
  }

  await deleteKunToken(input.uid)
  if (publicResourceCount > 0) {
    await invalidateResourceListCache()
  }

  return result
}
