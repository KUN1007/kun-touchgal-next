import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { patchRatingUpdateSchema } from '~/validations/patch'
import type { KunPatchRating } from '~/types/api/galgame'

export const updatePatchRating = async (
  input: z.infer<typeof patchRatingUpdateSchema>,
  uid: number,
  userRole: number
) => {
  const {
    ratingId,
    patchId,
    recommend,
    overall,
    playStatus,
    shortSummary,
    spoilerLevel
  } = input

  const rating = await prisma.patch_rating.findUnique({
    where: { id: ratingId }
  })
  if (!rating) {
    return '评价不存在'
  }
  const ratingUserUid = rating.user_id
  if (rating.user_id !== uid && userRole < 3) {
    return '您没有权限更新该评价'
  }

  const data = await prisma.patch_rating.update({
    where: { id: ratingId, user_id: ratingUserUid },
    data: {
      patch_id: patchId,
      recommend,
      overall,
      play_status: playStatus,
      short_summary: shortSummary,
      spoiler_level: spoilerLevel
    },
    include: {
      patch: { select: { unique_id: true } },
      user: {
        select: {
          id: true,
          name: true,
          avatar: true
        }
      },
      _count: {
        select: { like: true }
      },
      like: {
        where: {
          user_id: uid
        }
      }
    }
  })

  return {
    id: data.id,
    uniqueId: data.patch.unique_id,
    recommend: data.recommend,
    overall: data.overall,
    playStatus: data.play_status,
    shortSummary: data.short_summary,
    spoilerLevel: data.spoiler_level,
    isLike: data.like.length > 0,
    likeCount: data._count.like,
    userId: data.user_id,
    patchId: data.patch_id,
    created: data.created,
    updated: data.updated,
    user: data.user
  } satisfies KunPatchRating
}
