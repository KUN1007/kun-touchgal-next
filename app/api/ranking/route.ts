import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { GalgameCardSelectField } from '~/constants/api/select'
import { rankingSchema } from '~/validations/ranking'
import { kunParseGetQuery } from '~/app/api/utils/parseQuery'
import { getNSFWHeader } from '~/app/api/utils/getNSFWHeader'
import type { RankingSortField, RankingCard } from '~/types/api/ranking'
import type { Prisma } from '~/prisma/generated/prisma/client'

const MAX_RANKING_ITEMS = 300

const RankingSelectField = {
  ...GalgameCardSelectField,
  rating_stat: {
    select: {
      avg_overall: true,
      count: true,
      rec_yes: true,
      rec_strong_yes: true
    }
  }
} as const

export const getRanking = async (
  input: z.infer<typeof rankingSchema>,
  nsfwEnable: Record<string, string | undefined>
) => {
  const { sortField, sortOrder, minRatingCount, page, limit } = input
  const safeLimit = Math.min(limit, 50)
  const offset = (page - 1) * safeLimit

  const where: Prisma.patchWhereInput = {
    ...nsfwEnable,
    rating_stat: {
      count: {
        gte: minRatingCount
      }
    }
  }

  const orderBy = buildOrderBy(sortField, sortOrder)

  const [patches, total] = await Promise.all([
    prisma.patch.findMany({
      take: safeLimit,
      skip: offset,
      where,
      orderBy,
      select: RankingSelectField
    }),
    prisma.patch.count({ where })
  ])

  const galgames: RankingCard[] = patches.map((gal) => {
    const ratingAvg = gal.rating_stat?.avg_overall ?? 0
    const ratingCount = gal.rating_stat?.count ?? 0
    const positive =
      (gal.rating_stat?.rec_yes ?? 0) + (gal.rating_stat?.rec_strong_yes ?? 0)

    return {
      id: gal.id,
      uniqueId: gal.unique_id,
      name: gal.name,
      banner: gal.banner,
      view: gal.view,
      download: gal.download,
      type: gal.type,
      language: gal.language,
      platform: gal.platform,
      tags: gal.tag.map((t) => t.tag.name).slice(0, 3),
      created: gal.created,
      _count: gal._count,
      averageRating: ratingCount > 0 ? Math.round(ratingAvg * 10) / 10 : 0,
      ratingCount,
      positiveRecommendCount: positive
    }
  })

  const cappedTotal = Math.min(total, MAX_RANKING_ITEMS)

  return { galgames, total: cappedTotal }
}

const buildOrderBy = (
  sortField: RankingSortField,
  sortOrder: 'asc' | 'desc'
):
  | Prisma.patchOrderByWithRelationInput
  | Prisma.patchOrderByWithRelationInput[] => {
  switch (sortField) {
    case 'rating':
      return { rating_stat: { avg_overall: sortOrder } }
    case 'rating_count':
      return { rating_stat: { count: sortOrder } }
    case 'like':
      return [
        { rating_stat: { rec_yes: sortOrder } },
        { rating_stat: { rec_strong_yes: sortOrder } }
      ]
    case 'favorite':
      return { favorite_folder: { _count: sortOrder } }
    case 'resource':
      return { resource: { _count: sortOrder } }
    case 'comment':
      return { comment: { _count: sortOrder } }
    case 'download':
      return { download: sortOrder }
    case 'view':
    default:
      return { view: sortOrder }
  }
}

export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, rankingSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const nsfwEnable = getNSFWHeader(req)

  const response = await getRanking(input, nsfwEnable)
  return NextResponse.json(response)
}
