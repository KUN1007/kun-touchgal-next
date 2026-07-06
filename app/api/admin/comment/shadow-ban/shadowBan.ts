import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { adminUpdateCommentShadowBanSchema } from '~/validations/admin'

const statusLabel: Record<number, string> = {
  0: '正常',
  1: '屏蔽',
  2: '隐藏'
}

export const updateCommentShadowBan = async (
  input: z.infer<typeof adminUpdateCommentShadowBanSchema>,
  adminUid: number
) => {
  const admin = await prisma.user.findUnique({ where: { id: adminUid } })
  if (!admin) {
    return '未找到该管理员'
  }

  const { commentId, status } = input

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
  if (comment.status === status) {
    return `该评论已处于${statusLabel[status]}状态`
  }

  await prisma.$transaction(async (prisma) => {
    await prisma.patch_comment.update({
      where: { id: commentId },
      data: { status }
    })

    await prisma.admin_log.create({
      data: {
        type: 'update',
        user_id: adminUid,
        content: `管理员 ${admin.name} 将用户 ${comment.user.name} 的评论 (ID: ${commentId}) 状态由 ${statusLabel[comment.status]} 修改为 ${statusLabel[status]}`
      }
    })
  })

  return {}
}
