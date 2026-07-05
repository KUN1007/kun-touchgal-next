import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { adminUpdateCommentShadowBanSchema } from '~/validations/admin'

export const updateCommentShadowBan = async (
  input: z.infer<typeof adminUpdateCommentShadowBanSchema>,
  adminUid: number
) => {
  const admin = await prisma.user.findUnique({ where: { id: adminUid } })
  if (!admin) {
    return '未找到该管理员'
  }

  const { commentId, shadowBan } = input
  const fromStatus = shadowBan ? 0 : 1
  const toStatus = shadowBan ? 1 : 0

  const comment = await prisma.patch_comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      status: true,
      user: { select: { name: true } }
    }
  })
  if (!comment) {
    return '未找到该评论'
  }
  if (comment.status !== fromStatus) {
    return shadowBan ? '该评论已处于屏蔽状态' : '该评论未处于屏蔽状态'
  }

  await prisma.$transaction(async (prisma) => {
    await prisma.patch_comment.update({
      where: { id: commentId },
      data: { status: toStatus }
    })

    await prisma.admin_log.create({
      data: {
        type: 'update',
        user_id: adminUid,
        content: `管理员 ${admin.name} ${shadowBan ? '屏蔽' : '取消屏蔽'}了用户 ${comment.user.name} 的评论 (ID: ${commentId})`
      }
    })
  })

  return {}
}
