import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePutBody } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { createDedupMessage } from '~/app/api/utils/message'

const ratingIdSchema = z.object({
  ratingId: z.coerce.number({ message: 'ID 不正确' }).min(1).max(9999999)
})

export const toggleRatingLike = async (
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
  if (rating.user_id === uid) {
    return '您不能给自己点赞'
  }

  const existingLike = await prisma.patch_rating_like.findUnique({
    where: {
      patch_rating_id_user_id: {
        patch_rating_id: ratingId,
        user_id: uid
      }
    }
  })

  return await prisma.$transaction(async (prisma) => {
    if (existingLike) {
      await prisma.patch_rating_like.delete({
        where: {
          patch_rating_id_user_id: {
            patch_rating_id: ratingId,
            user_id: uid
          }
        }
      })
    } else {
      await prisma.patch_rating_like.create({
        data: {
          patch_rating_id: ratingId,
          user_id: uid
        }
      })
    }

    await createDedupMessage({
      type: 'like',
      content: `有人点赞了您的 Galgame 评价 -> ${rating.short_summary.slice(0, 107)}`,
      sender_id: uid,
      recipient_id: rating.user_id,
      link: `/${rating.patch.unique_id}`
    })

    await prisma.user.update({
      where: { id: rating.user_id },
      data: { moemoepoint: { increment: existingLike ? -1 : 1 } }
    })

    return !existingLike
  })
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
