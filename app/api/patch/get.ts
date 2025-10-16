import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { getKv, setKv } from '~/lib/redis'
import { PATCH_CACHE_DURATION } from '~/config/cache'
import { roundOneDecimal } from '~/utils/rating/average'
import { KUN_GALGAME_RATING_RECOMMEND_CONST } from '~/constants/galgame'
import type { Patch } from '~/types/api/patch'

const CACHE_KEY = 'patch'

const uniqueIdSchema = z.object({
  uniqueId: z.string().min(8).max(8)
})

export const getPatchById = async (
  input: z.infer<typeof uniqueIdSchema>,
  uid: number
) => {
  const cachedPatch = await getKv(`${CACHE_KEY}:${input.uniqueId}`)
  if (cachedPatch) {
    return JSON.parse(cachedPatch) as Patch
  }

  const { uniqueId } = input

  const patch = await prisma.patch.findUnique({
    where: { unique_id: uniqueId },
    include: {
      user: true,
      tag: {
        select: {
          tag: {
            select: { name: true }
          }
        }
      },
      alias: {
        select: {
          name: true
        }
      },
      _count: {
        select: {
          favorite_folder: true,
          resource: true,
          comment: true
        }
      },
      favorite_folder: {
        where: {
          folder: {
            user_id: uid
          }
        }
      }
    }
  })

  if (!patch) {
    return '未找到对应 Galgame'
  }

  const [ratingAgg, recommendGroups, overallGroups] = await prisma.$transaction(
    [
      prisma.patch_rating.aggregate({
        where: { patch_id: patch.id },
        _avg: { overall: true },
        _count: { _all: true }
      }),
      prisma.patch_rating.groupBy({
        by: ['recommend'],
        where: { patch_id: patch.id },
        _count: { _all: true },
        orderBy: { recommend: 'asc' }
      }),
      prisma.patch_rating.groupBy({
        by: ['overall'],
        where: { patch_id: patch.id },
        _count: { _all: true },
        orderBy: { overall: 'asc' }
      })
    ]
  )

  const recommendCountMap: Record<string, number> = {}
  for (const k of KUN_GALGAME_RATING_RECOMMEND_CONST) {
    recommendCountMap[k] = 0
  }
  for (const g of recommendGroups) {
    const c = (g as any)._count?._all ?? 0
    recommendCountMap[g.recommend] = c
  }

  const scoreCountMap: Record<number, number> = {}
  for (let s = 1; s <= 10; s++) scoreCountMap[s] = 0
  for (const g of overallGroups as any[]) {
    const score = g.overall as number
    const c = g._count?._all ?? 0
    if (typeof score === 'number' && score >= 1 && score <= 10) {
      scoreCountMap[score] = c
    }
  }

  const response: Patch = {
    id: patch.id,
    uniqueId: patch.unique_id,
    vndbId: patch.vndb_id,
    name: patch.name,
    introduction: patch.introduction,
    banner: patch.banner,
    status: patch.status,
    view: patch.view,
    download: patch.download,
    type: patch.type,
    language: patch.language,
    platform: patch.platform,
    tags: patch.tag.map((t) => t.tag.name),
    alias: patch.alias.map((a) => a.name),
    isFavorite: patch.favorite_folder.length > 0,
    contentLimit: patch.content_limit,
    ratingSummary: {
      average: roundOneDecimal(ratingAgg._avg.overall),
      count: ratingAgg._count._all,
      histogram: Array.from({ length: 10 }, (_, i) => ({
        score: i + 1,
        count: scoreCountMap[i + 1]
      })),
      recommend: {
        strong_no: recommendCountMap.strong_no,
        no: recommendCountMap.no,
        neutral: recommendCountMap.neutral,
        yes: recommendCountMap.yes,
        strong_yes: recommendCountMap.strong_yes
      }
    },
    user: {
      id: patch.user.id,
      name: patch.user.name,
      avatar: patch.user.avatar
    },
    created: String(patch.created),
    updated: String(patch.updated),
    _count: patch._count
  }

  await setKv(
    `${CACHE_KEY}:${input.uniqueId}`,
    JSON.stringify(response),
    PATCH_CACHE_DURATION
  )

  return response
}
