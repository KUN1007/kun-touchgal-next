import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { searchSchema } from '~/validations/search'
import {
  GalgameCardSelectField,
  toGalgameCardCount
} from '~/constants/api/select'
import { getPatchVisibilityContext } from '~/app/api/utils/getPatchVisibilityContext'
import { Prisma } from '~/prisma/generated/prisma/client'
import { isMeiliEnabled } from '~/lib/meilisearch'
import {
  buildAttributesToSearchOn,
  buildGalgameSearchFilter,
  buildGalgameSearchSort,
  buildSearchQuery,
  matchExactIdQuery
} from '~/server/search/filter-builder'
import {
  fetchGalgameCardsByIds,
  queryGalgameIndex
} from '~/server/search/query'
import {
  resolveCompanyIdsByName,
  resolveTagIdsByName
} from '~/server/search/resolve'
import type { PatchVisibilityContext } from '~/app/api/utils/getPatchVisibilityContext'
import type { SearchSuggestionType } from '~/types/api/search'
import {
  buildGalgameDateFilter,
  buildGalgameOrderBy,
  buildGalgameWhere
} from '../utils/galgameQuery'

const normalizeMode = (mode: SearchSuggestionType['mode'] | undefined) =>
  mode === 'exclude' ? 'exclude' : 'include'

const searchGalgameWithMeili = async (
  input: z.infer<typeof searchSchema>,
  visibility: PatchVisibilityContext
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
    selectedMonths = ['all'],
    minRatingCount
  } = input

  const query = JSON.parse(queryString) as SearchSuggestionType[]

  const keywords = (mode: 'include' | 'exclude') =>
    query
      .filter(
        (item) => item.type === 'keyword' && normalizeMode(item.mode) === mode
      )
      .map((item) => item.name.trim())
      .filter(Boolean)

  const includeKeywords = keywords('include')
  const excludeKeywords = keywords('exclude')
  // 单一外部 ID 关键词（vndb / dlsite）走精确直查：以 filter 替代全文匹配
  const exactIdMatch = matchExactIdQuery(includeKeywords, excludeKeywords)

  const suggestions = (type: 'tag' | 'company', mode: 'include' | 'exclude') =>
    query.filter(
      (item) => item.type === type && normalizeMode(item.mode) === mode
    )

  // 有 id 的建议项直接用 id；无 id 的按名称/别名解析为 id 集合
  const resolveGroups = (
    items: SearchSuggestionType[],
    resolveByName: (name: string) => Promise<number[]>
  ) =>
    Promise.all(
      items.map((item) =>
        typeof item.id === 'number'
          ? Promise.resolve([item.id])
          : resolveByName(item.name)
      )
    )

  const [
    includeTagIdGroups,
    excludeTagIdGroups,
    includeCompanyIdGroups,
    excludeCompanyIdGroups
  ] = await Promise.all([
    resolveGroups(suggestions('tag', 'include'), resolveTagIdsByName),
    resolveGroups(suggestions('tag', 'exclude'), resolveTagIdsByName),
    resolveGroups(suggestions('company', 'include'), resolveCompanyIdsByName),
    resolveGroups(suggestions('company', 'exclude'), resolveCompanyIdsByName)
  ])

  const filter = buildGalgameSearchFilter({
    selectedType,
    selectedLanguage,
    selectedPlatform,
    years: selectedYears,
    months: selectedMonths,
    minRatingCount: sortField === 'rating' ? minRatingCount : 0,
    contentLimit: visibility.contentLimit,
    blockedTagIds: visibility.blockedTagIds,
    includeTagIdGroups,
    includeCompanyIdGroups,
    excludeTagIds: excludeTagIdGroups.flat(),
    excludeCompanyIds: excludeCompanyIdGroups.flat(),
    exactId: exactIdMatch ?? undefined
  })
  if (filter === null) {
    return { galgames: [] as GalgameCard[], total: 0 }
  }

  const { ids, total } = await queryGalgameIndex({
    q: exactIdMatch ? '' : buildSearchQuery(includeKeywords, excludeKeywords),
    filter,
    sort: buildGalgameSearchSort(sortField, sortOrder),
    page,
    hitsPerPage: limit,
    attributesToSearchOn: buildAttributesToSearchOn(searchOption)
  })

  return {
    galgames: await fetchGalgameCardsByIds(ids, visibility.visibilityWhere),
    total
  }
}

// 旧 Prisma 实现：Meilisearch 不可用时的运行时降级路径，勿删
const legacySearchGalgame = async (
  input: z.infer<typeof searchSchema>,
  visibilityWhere: Prisma.patchWhereInput
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
    selectedMonths = ['all'],
    minRatingCount
  } = input
  const offset = (page - 1) * limit
  const insensitive = Prisma.QueryMode.insensitive

  const query = JSON.parse(queryString) as SearchSuggestionType[]

  const buildKeywordCondition = (keyword: string): Prisma.patchWhereInput => ({
    OR: [
      { name: { contains: keyword, mode: insensitive } },
      { vndb_id: keyword },
      { vndb_relation_id: keyword },
      { dlsite_code: keyword },
      ...(searchOption.searchInIntroduction
        ? [{ introduction: { contains: keyword, mode: insensitive } }]
        : []),
      ...(searchOption.searchInAlias
        ? [
            {
              alias: {
                some: {
                  name: { contains: keyword, mode: insensitive }
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
                  tag: { name: { contains: keyword, mode: insensitive } }
                }
              }
            }
          ]
        : [])
    ]
  })

  const buildKeywordExcludeCondition = (
    keyword: string
  ): Prisma.patchWhereInput => ({
    AND: [
      {
        NOT: {
          name: {
            contains: keyword,
            mode: insensitive
          }
        }
      },
      {
        OR: [{ vndb_id: null }, { vndb_id: { not: keyword } }]
      },
      {
        OR: [{ vndb_relation_id: null }, { vndb_relation_id: { not: keyword } }]
      },
      {
        OR: [{ dlsite_code: null }, { dlsite_code: { not: keyword } }]
      },
      ...(searchOption.searchInIntroduction
        ? [
            {
              NOT: {
                introduction: {
                  contains: keyword,
                  mode: insensitive
                }
              }
            }
          ]
        : []),
      ...(searchOption.searchInAlias
        ? [
            {
              alias: {
                none: {
                  name: {
                    contains: keyword,
                    mode: insensitive
                  }
                }
              }
            }
          ]
        : []),
      ...(searchOption.searchInTag
        ? [
            {
              tag: {
                none: {
                  tag: {
                    name: {
                      contains: keyword,
                      mode: insensitive
                    }
                  }
                }
              }
            }
          ]
        : [])
    ]
  })

  const includedKeywords = query
    .filter(
      (item) =>
        item.type === 'keyword' && normalizeMode(item.mode) === 'include'
    )
    .map((item) => item.name.trim())
    .filter(Boolean)
  const includedTags = query.filter(
    (item) => item.type === 'tag' && normalizeMode(item.mode) === 'include'
  )
  const includedCompanies = query.filter(
    (item) => item.type === 'company' && normalizeMode(item.mode) === 'include'
  )
  const excludedKeywords = query
    .filter(
      (item) =>
        item.type === 'keyword' && normalizeMode(item.mode) === 'exclude'
    )
    .map((item) => item.name)
    .map((item) => item.trim())
    .filter(Boolean)
  const excludedTags = query.filter(
    (item) => item.type === 'tag' && normalizeMode(item.mode) === 'exclude'
  )
  const excludedCompanies = query.filter(
    (item) => item.type === 'company' && normalizeMode(item.mode) === 'exclude'
  )

  const dateFilter = buildGalgameDateFilter(selectedYears, selectedMonths)
  const where = buildGalgameWhere({
    selectedType,
    selectedLanguage,
    selectedPlatform,
    minRatingCount: sortField === 'rating' ? minRatingCount : 0,
    visibilityWhere
  })
  const orderBy = buildGalgameOrderBy(sortField, sortOrder)

  const queryCondition = [
    ...includedKeywords.map((q) => buildKeywordCondition(q)),

    visibilityWhere,

    ...includedTags.map((tag) => ({
      tag: {
        some: {
          ...(typeof tag.id === 'number'
            ? { tag_id: tag.id }
            : {
                tag: {
                  OR: [{ name: tag.name }, { alias: { has: tag.name } }]
                }
              })
        }
      }
    })),
    ...includedCompanies.map((company) => ({
      company: {
        some: {
          ...(typeof company.id === 'number'
            ? { company_id: company.id }
            : {
                company: {
                  OR: [
                    { name: company.name },
                    { alias: { has: company.name } },
                    { parent_brand: { has: company.name } }
                  ]
                }
              })
        }
      }
    })),
    ...excludedKeywords.map((q) => buildKeywordExcludeCondition(q)),
    ...excludedTags.map((tag) => ({
      NOT: {
        tag: {
          some: {
            ...(typeof tag.id === 'number'
              ? { tag_id: tag.id }
              : {
                  tag: {
                    OR: [{ name: tag.name }, { alias: { has: tag.name } }]
                  }
                })
          }
        }
      }
    })),
    ...excludedCompanies.map((company) => ({
      NOT: {
        company: {
          some: {
            ...(typeof company.id === 'number'
              ? { company_id: company.id }
              : {
                  company: {
                    OR: [
                      { name: company.name },
                      { alias: { has: company.name } },
                      { parent_brand: { has: company.name } }
                    ]
                  }
                })
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
    prisma.patch.count({
      where: { AND: queryCondition, ...dateFilter, ...where }
    })
  ])

  const galgames: GalgameCard[] = data.map((gal) => {
    const { favorite_count, resource_count, comment_count, ...rest } = gal
    return {
      ...rest,
      tags: gal.tag.map((t) => t.tag.name).slice(0, 3),
      uniqueId: gal.unique_id,
      _count: toGalgameCardCount({
        favorite_count,
        resource_count,
        comment_count
      }),
      averageRating: gal.rating_stat?.avg_overall
        ? Math.round(gal.rating_stat.avg_overall * 10) / 10
        : 0
    }
  })

  return { galgames, total }
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, searchSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const visibility = await getPatchVisibilityContext(req)

  if (isMeiliEnabled()) {
    try {
      const response = await searchGalgameWithMeili(input, visibility)
      return NextResponse.json(response)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Meilisearch 搜索失败，降级为 Prisma 实现:', error)
    }
  }

  const response = await legacySearchGalgame(input, visibility.visibilityWhere)
  return NextResponse.json(response)
}
