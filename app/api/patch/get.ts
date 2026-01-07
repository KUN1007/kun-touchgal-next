import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { getKv, setKv } from '~/lib/redis'
import { PATCH_CACHE_DURATION } from '~/config/cache'
import { roundOneDecimal } from '~/utils/rating/average'
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

  const stat = await prisma.patch_rating_stat.findUnique({
    where: { patch_id: patch.id }
  })

  const response: Patch = {
    id: patch.id,
    uniqueId: patch.unique_id,
    vndbId: patch.vndb_id,
    vndbRelationId: patch.vndb_relation_id,
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
    ratingSummary: stat
      ? {
          average: roundOneDecimal(stat.avg_overall),
          count: stat.count,
          histogram: [
            { score: 1, count: stat.o1 },
            { score: 2, count: stat.o2 },
            { score: 3, count: stat.o3 },
            { score: 4, count: stat.o4 },
            { score: 5, count: stat.o5 },
            { score: 6, count: stat.o6 },
            { score: 7, count: stat.o7 },
            { score: 8, count: stat.o8 },
            { score: 9, count: stat.o9 },
            { score: 10, count: stat.o10 }
          ],
          recommend: {
            strong_no: stat.rec_strong_no,
            no: stat.rec_no,
            neutral: stat.rec_neutral,
            yes: stat.rec_yes,
            strong_yes: stat.rec_strong_yes
          }
        }
      : {
          average: 0,
          count: 0,
          histogram: Array.from({ length: 10 }, (_, i) => ({
            score: i + 1,
            count: 0
          })),
          recommend: {
            strong_no: 0,
            no: 0,
            neutral: 0,
            yes: 0,
            strong_yes: 0
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
