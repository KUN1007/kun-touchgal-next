import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { searchSchema } from '~/validations/search'
import { GalgameCardSelectField } from '~/constants/api/select'
import { getNSFWHeader } from '~/app/api/utils/getNSFWHeader'
import { Prisma } from '@prisma/client'
import type { SearchSuggestionType } from '~/types/api/search'

export const searchGalgame = async (
  input: z.infer<typeof searchSchema>,
  nsfwEnable: Record<string, string | undefined>
) => {
  const {
    queryString,
    limit,
    searchOption,
    page,
    selectedType = 'all',
    selectedLanguage = 'all',
    selectedPlatform = 'all',
    sortField,
    sortOrder,
    selectedYears = ['all'],
    selectedMonths = ['all']
  } = input
  const offset = (page - 1) * limit
  const insensitive = Prisma.QueryMode.insensitive

  const query = JSON.parse(queryString) as SearchSuggestionType[]

  const queryArray = query
    .filter((item) => item.type === 'keyword')
    .map((item) => item.name)
  const tagArray = query
    .filter((item) => item.type === 'tag')
    .map((item) => item.name)

  let dateFilter = {}
  if (!selectedYears.includes('all')) {
    const dateConditions = []

    if (selectedYears.includes('future')) {
      dateConditions.push({ released: 'future' })
    }

    if (selectedYears.includes('unknown')) {
      dateConditions.push({ released: 'unknown' })
    }

    const nonFutureYears = selectedYears.filter((year) => year !== 'future')
    if (nonFutureYears.length > 0) {
      if (!selectedMonths.includes('all')) {
        const yearMonthConditions = nonFutureYears.flatMap((year) =>
          selectedMonths.map((month) => ({
            released: {
              startsWith: `${year}-${month}`
            }
          }))
        )
        dateConditions.push(...yearMonthConditions)
      } else {
        const yearConditions = nonFutureYears.map((year) => ({
          released: {
            startsWith: year
          }
        }))
        dateConditions.push(...yearConditions)
      }
    }

    if (dateConditions.length > 0) {
      dateFilter = { OR: dateConditions }
    }
  }

  // Other fields sort
  const where = {
    ...(selectedType !== 'all' && { type: { has: selectedType } }),
    ...(selectedLanguage !== 'all' && { language: { has: selectedLanguage } }),
    ...(selectedPlatform !== 'all' && { platform: { has: selectedPlatform } }),
    ...nsfwEnable
  }

  const orderBy =
    sortField === 'favorite'
      ? { favorite_folder: { _count: sortOrder } }
      : { [sortField]: sortOrder }

  const queryCondition = [
    ...queryArray.map((q) => ({
      OR: [
        { name: { contains: q, mode: insensitive } },
        { vndb_id: q },
        ...(searchOption.searchInIntroduction
          ? [{ introduction: { contains: q, mode: insensitive } }]
          : []),
        ...(searchOption.searchInAlias
          ? [
              {
                alias: {
                  some: {
                    name: { contains: q, mode: insensitive }
                  }
                }
              }
            ]
          : []),
        ...(searchOption.searchInTag
          ? [
              {
                tag: {
                  some: {
                    tag: { name: { contains: q, mode: insensitive } }
                  }
                }
              }
            ]
          : [])
      ]
    })),

    nsfwEnable,

    ...tagArray.map((q) => ({
      tag: {
        some: {
          tag: {
            OR: [{ name: q }, { alias: { has: q } }]
          }
        }
      }
    }))
  ]

  const [data, total] = await Promise.all([
    prisma.patch.findMany({
      take: limit,
      skip: offset,
      orderBy,
      where: { AND: queryCondition, ...dateFilter, ...where },
      select: GalgameCardSelectField
    }),
    await prisma.patch.count({
      where: { AND: queryCondition, ...dateFilter, ...where }
    })
  ])

  const galgames: GalgameCard[] = data.map((gal) => ({
    ...gal,
    tags: gal.tag.map((t) => t.tag.name).slice(0, 3),
    uniqueId: gal.unique_id,
    averageRating: gal.rating_stat?.avg_overall
      ? Math.round(gal.rating_stat.avg_overall * 10) / 10
      : 0
  }))

  return { galgames, total }
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, searchSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const nsfwEnable = getNSFWHeader(req)

  const response = await searchGalgame(input, nsfwEnable)
  return NextResponse.json(response)
}
