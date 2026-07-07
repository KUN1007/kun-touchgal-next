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
  // 作者判断必须先于 status: 否则被 shadow ban 的作者对自己 status=1 的评论点赞时,
  // 响应会从 '您不能给自己点赞' 变为 '未找到评论', 反向暴露封禁
  if (comment.user_id === uid) {
    return '您不能给自己点赞'
  }
  // 仅公开 (status=0) 评论可被他人点赞; status=1 (shadow ban) / 2 (隐藏) 与不存在等同,
  // 防止通过点赞探测 shadow ban, 也避免向被封作者发通知
  if (comment.status !== 0) {
    return '未找到评论'
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
  const messageData = {
    type: 'like' as const,
    content: `赞了您的评论：${comment.content.slice(0, 107)}`,
    sender_id: uid,
    recipient_id: comment.user_id,
    link: `/${comment.patch.unique_id}?tab=comments&commentId=${comment.id}`
  }
  const legacyMessageLink = `/${comment.patch.unique_id}`

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
      await tx.user_message.deleteMany({
        where: {
          type: 'like',
          sender_id: uid,
          recipient_id: comment.user_id,
          OR: [
            { link: messageData.link },
            { link: legacyMessageLink, content: messageData.content }
          ]
        }
      })
    } else {
      await tx.user_patch_comment_like_relation.create({
        data: {
          user_id: uid,
          comment_id: commentId
        }
      })
      await createDedupMessage(messageData, tx)
    }

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
