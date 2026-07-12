import { createHash } from 'crypto'
import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { delKv, getKv, setKv, setKvIfAbsent } from '~/lib/redis'
import { GALGAME_LIST_CACHE_DURATION } from '~/config/cache'
import { galgameSchema } from '~/validations/galgame'
import {
  GalgameCardSelectField,
  toGalgameCardCount
} from '~/constants/api/select'
import {
  buildGalgameDateFilter,
  buildGalgameOrderBy,
  buildGalgameWhere
} from '../utils/galgameQuery'
import { buildVisibilityCacheKey } from '../utils/visibilityCacheKey'
import { kunCacheSingleflight } from '~/app/api/utils/cacheSingleflight'
import { parseGalgameFilterArray } from '~/utils/galgameFilter'
import { isMeiliEnabled } from '~/lib/meilisearch'
import {
  buildGalgameSearchFilter,
  buildGalgameSearchSort
} from '~/server/search/filter-builder'
import { queryGalgameIndex } from '~/server/search/query'
import type { PatchVisibilityContext } from '../utils/getPatchVisibilityContext'
import type { Prisma } from '~/prisma/generated/prisma/client'

const normalizeFilterValues = (values: string[]) => [...new Set(values)].sort()

const GALGAME_LIST_CACHE_KEY_PREFIX = 'galgame:list'

interface GalgameListResponse {
  galgames: GalgameCard[]
  total: number
}

interface GalgameListCacheResult {
  response: GalgameListResponse | null
  canWrite: boolean
}

const logGalgameListCacheError = (message: string, error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(message, error)
}

const getGalgameListCacheKey = (
  input: z.infer<typeof galgameSchema>,
  years: string[],
  months: string[],
  visibilityWhere: Prisma.patchWhereInput
) => {
  const parts = [
    input.selectedType,
    input.selectedLanguage,
    input.selectedPlatform,
    input.sortField,
    input.sortOrder,
    String(input.page),
    String(input.limit),
    String(input.minRatingCount),
    normalizeFilterValues(years).join(','),
    normalizeFilterValues(months).join(','),
    buildVisibilityCacheKey(visibilityWhere)
  ].join('|')
  const hash = createHash('sha1').update(parts).digest('hex').slice(0, 16)
  return `${GALGAME_LIST_CACHE_KEY_PREFIX}:${hash}`
}

const deleteGalgameListCache = async (cacheKey: string) => {
  try {
    await delKv(cacheKey)
  } catch (error) {
    logGalgameListCacheError(
      'Failed to delete invalid galgame list cache:',
      error
    )
  }
}

const getCachedGalgameList = async (
  cacheKey: string
): Promise<GalgameListCacheResult> => {
  let cached: string | null

  try {
    cached = await getKv(cacheKey)
  } catch (error) {
    logGalgameListCacheError('Failed to read galgame list cache:', error)
    return { response: null, canWrite: false }
  }

  if (!cached) {
    return { response: null, canWrite: true }
  }

  try {
    return {
      response: JSON.parse(cached) as GalgameListResponse,
      canWrite: true
    }
  } catch (error) {
    logGalgameListCacheError('Failed to parse galgame list cache:', error)
    await deleteGalgameListCache(cacheKey)
    return { response: null, canWrite: true }
  }
}

const setGalgameListCache = async (
  cacheKey: string,
  response: GalgameListResponse
) => {
  try {
    await setKv(cacheKey, JSON.stringify(response), GALGAME_LIST_CACHE_DURATION)
  } catch (error) {
    logGalgameListCacheError('Failed to write galgame list cache:', error)
  }
}

const setGalgameListCacheIfAbsent = async (
  cacheKey: string,
  response: GalgameListResponse
) => {
  try {
    await setKvIfAbsent(
      cacheKey,
      JSON.stringify(response),
      GALGAME_LIST_CACHE_DURATION
    )
  } catch (error) {
    logGalgameListCacheError('Failed to write galgame list cache:', error)
  }
}

const getGalgameFromSearch = async (
  input: z.infer<typeof galgameSchema>,
  years: string[],
  months: string[],
  visibility: PatchVisibilityContext
): Promise<GalgameListResponse> => {
  const filter = buildGalgameSearchFilter({
    selectedType: input.selectedType,
    selectedLanguage: input.selectedLanguage,
    selectedPlatform: input.selectedPlatform,
    years,
    months,
    // 列表端点的 minRatingCount 恒生效，与旧实现一致
    minRatingCount: input.minRatingCount,
    contentLimit: visibility.contentLimit,
    blockedTagIds: visibility.blockedTagIds
  })
  if (filter === null) {
    return { galgames: [], total: 0 }
  }

  const { galgames, total } = await queryGalgameIndex({
    q: '',
    filter,
    sort: buildGalgameSearchSort(input.sortField, input.sortOrder),
    page: input.page,
    hitsPerPage: input.limit
  })

  return {
    galgames,
    total
  }
}

// 旧 Prisma 实现：Meilisearch 不可用时的运行时降级路径，勿删
const getGalgameFromPrisma = async (
  input: z.infer<typeof galgameSchema>,
  years: string[],
  months: string[],
  visibilityWhere: Prisma.patchWhereInput
): Promise<GalgameListResponse> => {
  const {
    selectedType = 'all',
    selectedLanguage = 'all',
    selectedPlatform = 'all',
    sortField,
    sortOrder,
    page,
    limit,
    minRatingCount
  } = input

  const offset = (page - 1) * limit
  const dateFilter = buildGalgameDateFilter(years, months)
  const where = buildGalgameWhere({
    selectedType,
    selectedLanguage,
    selectedPlatform,
    minRatingCount,
    visibilityWhere
  })
  const orderBy = buildGalgameOrderBy(sortField, sortOrder)

  const [data, total] = await Promise.all([
    prisma.patch.findMany({
      take: limit,
      skip: offset,
      orderBy,
      where: {
        ...dateFilter,
        ...where
      },
      select: GalgameCardSelectField
    }),
    prisma.patch.count({
      where: {
        ...dateFilter,
        ...where
      }
    })
  ])

  const galgames: GalgameCard[] = data.map((gal) => ({
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
    _count: toGalgameCardCount(gal),
    averageRating: gal.rating_stat?.avg_overall
      ? Math.round(gal.rating_stat.avg_overall * 10) / 10
      : 0
  }))

  return { galgames, total }
}

const queryGalgameList = async (
  input: z.infer<typeof galgameSchema>,
  years: string[],
  months: string[],
  visibility: PatchVisibilityContext
): Promise<GalgameListResponse> => {
  if (isMeiliEnabled()) {
    try {
      return await getGalgameFromSearch(input, years, months, visibility)
    } catch (error) {
      logGalgameListCacheError(
        'Meilisearch 列表查询失败，降级为 Prisma 实现:',
        error
      )
    }
  }
  return getGalgameFromPrisma(input, years, months, visibility.visibilityWhere)
}

export const getGalgame = async (
  input: z.infer<typeof galgameSchema>,
  visibility: PatchVisibilityContext
): Promise<GalgameListResponse> => {
  const years = parseGalgameFilterArray(input.yearString)
  const months = parseGalgameFilterArray(input.monthString)

  const cacheKey = getGalgameListCacheKey(
    input,
    years,
    months,
    visibility.visibilityWhere
  )

  const cached = await getCachedGalgameList(cacheKey)
  if (cached.response) {
    return cached.response
  }

  // 缓存读失败 (canWrite=false) 不参与单飞, 避免阻塞在锁上
  if (!cached.canWrite) {
    return queryGalgameList(input, years, months, visibility)
  }

  return kunCacheSingleflight({
    cacheKey,
    readCache: async () => (await getCachedGalgameList(cacheKey)).response,
    writeCache: (response) => setGalgameListCache(cacheKey, response),
    writeCacheIfAbsent: (response) =>
      setGalgameListCacheIfAbsent(cacheKey, response),
    query: () => queryGalgameList(input, years, months, visibility)
  })
}
