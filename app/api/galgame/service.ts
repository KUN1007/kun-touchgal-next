import { createHash } from 'crypto'
import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { delKv, getKv, setKv } from '~/lib/redis'
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
import { parseGalgameFilterArray } from '~/utils/galgameFilter'
import type { Prisma } from '~/prisma/generated/prisma/client'

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
  const payload = {
    selectedType: input.selectedType,
    selectedLanguage: input.selectedLanguage,
    selectedPlatform: input.selectedPlatform,
    sortField: input.sortField,
    sortOrder: input.sortOrder,
    page: input.page,
    limit: input.limit,
    minRatingCount: input.minRatingCount,
    years,
    months,
    visibility: visibilityWhere
  }
  const hash = createHash('sha1')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 16)
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
    await setKv(
      cacheKey,
      JSON.stringify(response),
      GALGAME_LIST_CACHE_DURATION
    )
  } catch (error) {
    logGalgameListCacheError('Failed to write galgame list cache:', error)
  }
}

export const getGalgame = async (
  input: z.infer<typeof galgameSchema>,
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
  const years = parseGalgameFilterArray(input.yearString)
  const months = parseGalgameFilterArray(input.monthString)

  const cacheKey = getGalgameListCacheKey(input, years, months, visibilityWhere)

  const cached = await getCachedGalgameList(cacheKey)
  if (cached.response) {
    return cached.response
  }

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

  const response: GalgameListResponse = { galgames, total }

  if (cached.canWrite) {
    await setGalgameListCache(cacheKey, response)
  }

  return response
}
