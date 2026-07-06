import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { recomputePatchRatingStat } from '~/app/api/patch/rating/stat'
import { adminUpdateRatingShadowBanSchema } from '~/validations/admin'

const statusLabel: Record<number, string> = {
  0: '正常',
  1: '屏蔽',
  2: '隐藏'
}

export const updateRatingShadowBan = async (
  input: z.infer<typeof adminUpdateRatingShadowBanSchema>,
  adminUid: number
) => {
  const admin = await prisma.user.findUnique({ where: { id: adminUid } })
  if (!admin) {
    return '未找到该管理员'
  }

  const { ratingId, status } = input

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
  if (rating.status === status) {
    return `该评价已处于${statusLabel[status]}状态`
  }

  await prisma.$transaction(async (prisma) => {
    await prisma.patch_rating.update({
      where: { id: ratingId },
      data: { status }
    })

    await prisma.admin_log.create({
      data: {
        type: 'update',
        user_id: adminUid,
        content: `管理员 ${admin.name} 将用户 ${rating.user.name} 的评价 (ID: ${ratingId}) 状态由 ${statusLabel[rating.status]} 修改为 ${statusLabel[status]}`
      }
    })
  })

  // 屏蔽 / 隐藏的评价不计入评分统计, 与 create/delete 流程一致重算
  await recomputePatchRatingStat(rating.patch_id)

  return {}
}
