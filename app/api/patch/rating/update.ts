import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { patchRatingUpdateSchema } from '~/validations/patch'

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

  await prisma.patch_rating.update({
    where: { id: ratingId, user_id: ratingUserUid },
    data: {
      patch_id: patchId,
      recommend,
      overall,
      play_status: playStatus,
      short_summary: shortSummary,
      spoiler_level: spoilerLevel
    }
  })

  return {}
}
