import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePutBody } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { createDedupMessage } from '~/app/api/utils/message'
import { invalidateUserSession } from '~/app/api/user/session/cache'
import { PatchRefSelectField } from '~/constants/api/select'

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
    include: { patch: { select: PatchRefSelectField } }
  })
  if (!rating) {
    return '评价不存在'
  }
  if (rating.user_id === uid) {
    return '您不能给自己点赞'
  }
  // 待审核 (status=1) 的评价不可点赞; 隐藏 (status=2) 的评价前端不可见, 与不存在等同
  if (rating.status === 1) {
    return '该评价正在审核中, 暂时无法点赞'
  }
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
