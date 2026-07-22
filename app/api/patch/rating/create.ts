import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { patchRatingCreateSchema } from '~/validations/patch'
import { recomputePatchRatingStat } from './stat'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'
import { createModerationTask, preScreenText } from '~/server/moderation/submit'
import type { KunPatchRating } from '~/types/api/galgame'

export const createPatchRating = async (
  input: z.infer<typeof patchRatingCreateSchema>,
  uid: number,
  userRole: number
) => {
  const {
    patchId,
    recommend,
    overall,
    playStatus,
    shortSummary,
    spoilerLevel
  } = input

  const exists = await prisma.patch_rating.findUnique({
    where: {
      user_id_patch_id: { user_id: uid, patch_id: patchId }
    }
  })
  if (exists) {
    return '您已经评价过该游戏'
  }

  const moderation = await preScreenText(shortSummary, userRole)

  const data = await prisma.$transaction(async (tx) => {
    const created = await tx.patch_rating.create({
      data: {
        patch_id: patchId,
        user_id: uid,
        recommend,
        overall,
        play_status: playStatus,
        short_summary: shortSummary,
        spoiler_level: spoilerLevel,
        status: moderation.intercept ? 1 : 0
      },
      include: {
        patch: {
          select: {
            unique_id: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    })

    if (moderation.queue) {
      await createModerationTask(
        {
          contentType: 'rating',
          contentId: created.id,
          patchId,
          userId: uid,
          payload: { text: shortSummary },
          dryRun: moderation.dryRun
        },
        tx
      )
    }

    await recomputePatchRatingStat(patchId, tx)
    return created
  })

  // 事务提交后失效补丁详情缓存: ratingSummary 随评分统计变化 (M-05)
  await invalidatePatchContentCache(data.patch.unique_id).catch(() => undefined)

  return {
    id: data.id,
    uniqueId: data.patch.unique_id,
    recommend: data.recommend,
    overall: data.overall,
    playStatus: data.play_status,
    shortSummary: data.short_summary,
    spoilerLevel: data.spoiler_level,
    status: data.status,
    isLike: false,
    likeCount: 0,
    userId: data.user_id,
    patchId: data.patch_id,
    created: data.created,
    updated: data.updated,
    user: data.user
  } satisfies KunPatchRating
}
