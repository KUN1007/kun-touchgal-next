import { z } from 'zod'
import { prisma } from '~/prisma/index'

const patchIdSchema = z.object({
  patchId: z.coerce.number().min(1).max(9999999)
})

export const getPatchRating = async (
  input: z.infer<typeof patchIdSchema>,
  uid: number
) => {
  const { patchId } = input

  const data = await prisma.patch_rating.findMany({
    where: { patch_id: patchId },
    include: {
      patch: { select: { unique_id: true } },
      user: true,
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

  const ratings = data.map((rating) => ({
    id: rating.id,
    uniqueId: rating.patch.unique_id,
    recommend: rating.recommend,
    overall: rating.overall,
    playStatus: rating.play_status,
    shortSummary: rating.short_summary,
    spoilerLevel: rating.spoiler_level,
    isLike: rating.like.length > 0,
    likeCount: rating._count.like,
    userId: rating.user_id,
    patchId: rating.patch_id,
    created: String(rating.created),
    updated: String(rating.updated),
    user: {
      id: rating.user.id,
      name: rating.user.name,
      avatar: rating.user.avatar
    }
  }))

  return ratings
}
