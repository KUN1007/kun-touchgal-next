import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePutBody } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { createDedupMessage } from '~/app/api/utils/message'
import { invalidateUserSession } from '~/app/api/user/session/cache'

const ratingIdSchema = z.object({
  ratingId: z.coerce.number({ message: 'ID 不正确' }).min(1).max(9999999)
})

const toggleRatingLike = async (
  input: z.infer<typeof ratingIdSchema>,
  uid: number
) => {
  const { ratingId } = input

  const rating = await prisma.patch_rating.findUnique({
    where: { id: ratingId },
    include: { patch: { select: { unique_id: true, name: true } } }
  })
  if (!rating) {
    return '评价不存在'
  }
  // 作者判断必须先于 status: 否则被 shadow ban 的作者对自己 status=1 的评价点赞时,
  // 响应会从 '您不能给自己点赞' 变为 '评价不存在', 反向暴露封禁
  if (rating.user_id === uid) {
    return '您不能给自己点赞'
  }
  // 仅公开 (status=0) 评价可被他人点赞; status=1 (shadow ban) / 2 (隐藏) 与不存在等同,
  // 防止通过点赞探测 shadow ban, 也避免向被封作者发通知
  if (rating.status !== 0) {
    return '评价不存在'
  }

  const existingLike = await prisma.patch_rating_like.findUnique({
    where: {
      patch_rating_id_user_id: {
        patch_rating_id: ratingId,
        user_id: uid
      }
    }
  })
  const messageData = {
    type: 'like' as const,
    content: `赞了您的评价：${rating.short_summary.slice(0, 107)}`,
    sender_id: uid,
    recipient_id: rating.user_id,
    link: `/${rating.patch.unique_id}?tab=rating&ratingId=${rating.id}`
  }

  const response = await prisma.$transaction(async (tx) => {
    if (existingLike) {
      await tx.patch_rating_like.delete({
        where: {
          patch_rating_id_user_id: {
            patch_rating_id: ratingId,
            user_id: uid
          }
        }
      })
      await tx.user_message.deleteMany({
        where: {
          type: 'like',
          sender_id: uid,
          recipient_id: rating.user_id,
          link: messageData.link
        }
      })
    } else {
      await tx.patch_rating_like.create({
        data: {
          patch_rating_id: ratingId,
          user_id: uid
        }
      })
      await createDedupMessage(messageData, tx)
    }

    await tx.user.update({
      where: { id: rating.user_id },
      data: { moemoepoint: { increment: existingLike ? -1 : 1 } }
    })

    return !existingLike
  })

  await invalidateUserSession(rating.user_id)
  return response
}

export const PUT = async (req: NextRequest) => {
  const input = await kunParsePutBody(req, ratingIdSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('请先登录')
  }

  const response = await toggleRatingLike(input, payload.uid)
  return NextResponse.json(response)
}
