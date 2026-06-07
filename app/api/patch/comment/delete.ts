import { z } from 'zod'
import { prisma } from '~/prisma/index'
import type { Prisma } from '~/prisma/generated/prisma/client'

const commentIdSchema = z.object({
  commentId: z.coerce
    .number({ message: '评论 ID 必须为数字' })
    .min(1)
    .max(9999999)
})

type CommentDeleteClient = Prisma.TransactionClient | typeof prisma

interface CommentForDelete {
  id: number
  user_id: number
  parent_id: number | null
  patch: { unique_id: string }
  parent: { user_id: number } | null
}

const commentForDeleteSelect = {
  id: true,
  user_id: true,
  parent_id: true,
  patch: { select: { unique_id: true } },
  parent: { select: { user_id: true } }
} as const

const deleteCommentWithReplies = async (
  comment: CommentForDelete,
  db: CommentDeleteClient
) => {
  const childComments = await db.patch_comment.findMany({
    where: { parent_id: comment.id },
    select: commentForDeleteSelect
  })

  for (const child of childComments) {
    await deleteCommentWithReplies(child, db)
  }

  if (comment.parent_id && comment.parent) {
    await db.user_message.deleteMany({
      where: {
        type: 'comment',
        sender_id: comment.user_id,
        recipient_id: comment.parent.user_id,
        link: `/${comment.patch.unique_id}?tab=comments&commentId=${comment.id}`
      }
    })
  }

  await db.patch_comment.delete({
    where: { id: comment.id }
  })
}

export const deleteComment = async (
  input: z.infer<typeof commentIdSchema>,
  uid: number,
  userRole: number
) => {
  const comment = await prisma.patch_comment.findUnique({
    where: {
      id: input.commentId
    },
    select: commentForDeleteSelect
  })
  if (!comment) {
    return '未找到对应的评论'
  }

  if (comment.user_id !== uid && userRole < 3) {
    return '您没有权限删除该评论'
  }

  return await prisma.$transaction(async (tx) => {
    await deleteCommentWithReplies(comment, tx)
    return {}
  })
}
