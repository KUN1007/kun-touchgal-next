import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePutBody } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { createDedupMessage } from '~/app/api/utils/message'
import { invalidateUserSession } from '~/app/api/user/session/cache'

const commentIdSchema = z.object({
  commentId: z.coerce
    .number({ message: '评论 ID 必须为数字' })
    .min(1)
    .max(9999999)
})

const toggleCommentLike = async (
  input: z.infer<typeof commentIdSchema>,
  uid: number
) => {
  const { commentId } = input

  const comment = await prisma.patch_comment.findUnique({
    where: { id: commentId },
    include: { patch: { select: { unique_id: true } } }
  })
  if (!comment) {
    return '未找到评论'
  }
  if (comment.user_id === uid) {
    return '您不能给自己点赞'
  }

  const existingLike = await prisma.user_patch_comment_like_relation.findUnique(
    {
      where: {
        user_id_comment_id: {
          user_id: uid,
          comment_id: commentId
        }
      }
    }
  )

  const response = await prisma.$transaction(async (tx) => {
    if (existingLike) {
      await tx.user_patch_comment_like_relation.delete({
        where: {
          user_id_comment_id: {
            user_id: uid,
            comment_id: commentId
          }
        }
      })
    } else {
      await tx.user_patch_comment_like_relation.create({
        data: {
          user_id: uid,
          comment_id: commentId
        }
      })
    }

    await createDedupMessage(
      {
        type: 'like',
        content: `赞了您的评论：${comment.content.slice(0, 107)}`,
        sender_id: uid,
        recipient_id: comment.user_id,
        link: `/${comment.patch.unique_id}`
      },
      tx
    )

    await tx.user.update({
      where: { id: comment.user_id },
      data: { moemoepoint: { increment: existingLike ? -1 : 1 } }
    })

    return !existingLike
  })

  await invalidateUserSession(comment.user_id)
  return response
}

export const PUT = async (req: NextRequest) => {
  const input = await kunParsePutBody(req, commentIdSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const response = await toggleCommentLike(input, payload.uid)
  return NextResponse.json(response)
}
