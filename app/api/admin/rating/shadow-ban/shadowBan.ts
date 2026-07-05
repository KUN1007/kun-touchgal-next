import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { recomputePatchRatingStat } from '~/app/api/patch/rating/stat'
import { adminUpdateRatingShadowBanSchema } from '~/validations/admin'

export const updateRatingShadowBan = async (
  input: z.infer<typeof adminUpdateRatingShadowBanSchema>,
  adminUid: number
) => {
  const admin = await prisma.user.findUnique({ where: { id: adminUid } })
  if (!admin) {
    return '未找到该管理员'
  }

  const { ratingId, shadowBan } = input
  const fromStatus = shadowBan ? 0 : 1
  const toStatus = shadowBan ? 1 : 0

  const rating = await prisma.patch_rating.findUnique({
    where: { id: ratingId },
    select: {
      id: true,
      status: true,
      patch_id: true,
      user: { select: { name: true } }
    }
  })
  if (!rating) {
    return '未找到该评价'
  }
  if (rating.status !== fromStatus) {
    return shadowBan ? '该评价已处于屏蔽状态' : '该评价未处于屏蔽状态'
  }

  await prisma.$transaction(async (prisma) => {
    await prisma.patch_rating.update({
      where: { id: ratingId },
      data: { status: toStatus }
    })

    await prisma.admin_log.create({
      data: {
        type: 'update',
        user_id: adminUid,
        content: `管理员 ${admin.name} ${shadowBan ? '屏蔽' : '取消屏蔽'}了用户 ${rating.user.name} 的评价 (ID: ${ratingId})`
      }
    })
  })

  // 屏蔽的评价不计入评分统计, 与 create/delete 流程一致重算
  await recomputePatchRatingStat(rating.patch_id)

  return {}
}
