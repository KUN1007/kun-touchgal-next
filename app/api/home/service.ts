import { prisma } from '~/prisma/index'
import { delKv, getKv, setKv } from '~/lib/redis'
import { HOME_CACHE_DURATION } from '~/config/cache'
import { HomeResource } from '~/types/api/home'
import {
  GalgameCardSelectField,
  toGalgameCardCount
} from '~/constants/api/select'
import { buildVisibilityCacheKey } from '../utils/visibilityCacheKey'
import type { Prisma } from '~/prisma/generated/prisma/client'

const HOME_CACHE_KEY_PREFIX = 'home'

const getHomeCacheKey = (visibilityWhere: Prisma.patchWhereInput) =>
  `${HOME_CACHE_KEY_PREFIX}:${buildVisibilityCacheKey(visibilityWhere)}`

interface HomeResponse {
  galgames: GalgameCard[]
  resources: HomeResource[]
}

interface HomeCacheResult {
  response: HomeResponse | null
  canWrite: boolean
}

const logHomeCacheError = (message: string, error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(message, error)
}

const deleteHomeCache = async (cacheKey: string) => {
  try {
    await delKv(cacheKey)
  } catch (error) {
    logHomeCacheError('Failed to delete invalid home cache:', error)
  }
}

const getCachedHomeData = async (
  cacheKey: string
): Promise<HomeCacheResult> => {
  let cached: string | null

  try {
    cached = await getKv(cacheKey)
  } catch (error) {
    logHomeCacheError('Failed to read home cache:', error)
    return { response: null, canWrite: false }
  }

  if (!cached) {
    return { response: null, canWrite: true }
  }

  try {
    return { response: JSON.parse(cached) as HomeResponse, canWrite: true }
  } catch (error) {
    logHomeCacheError('Failed to parse home cache:', error)
    await deleteHomeCache(cacheKey)
    return { response: null, canWrite: true }
  }
}

const setHomeCache = async (cacheKey: string, response: HomeResponse) => {
  try {
    await setKv(cacheKey, JSON.stringify(response), HOME_CACHE_DURATION)
  } catch (error) {
    logHomeCacheError('Failed to write home cache:', error)
  }
}

export const getHomeData = async (
  visibilityWhere: Prisma.patchWhereInput
): Promise<HomeResponse> => {
  const cacheKey = getHomeCacheKey(visibilityWhere)

  const cached = await getCachedHomeData(cacheKey)
  if (cached.response) {
    return cached.response
  }

  const [data, resourcesData] = await Promise.all([
    prisma.patch.findMany({
      orderBy: { created: 'desc' },
      where: visibilityWhere,
      select: GalgameCardSelectField,
      take: 20
    }),
    prisma.patch_resource.findMany({
      orderBy: { created: 'desc' },
      where: { patch: visibilityWhere, section: 'patch', status: 0 },
      include: {
        patch: {
          select: {
            name: true,
            unique_id: true
          }
        },
        user: {
          include: {
            _count: {
              select: { patch_resource: true }
            }
          }
        },
        links: {
          orderBy: { sort_order: 'asc' }
        },
        _count: {
          select: {
            like_by: true
          }
        }
      },
      take: 6
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

  const resources: HomeResource[] = resourcesData.map((resource) => ({
    id: resource.id,
    name: resource.name,
    section: resource.section,
    uniqueId: resource.patch.unique_id,
    type: resource.type,
    language: resource.language,
    note: resource.note.slice(0, 233),
    platform: resource.platform,
    links: resource.links.map((link) => ({
      id: link.id,
      storage: link.storage,
      size: link.size,
      code: link.code,
      password: link.password,
      hash: link.hash,
      content: link.content,
      sortOrder: link.sort_order,
      download: link.download
    })),
    likeCount: resource._count.like_by,
    download: resource.download,
    patchId: resource.patch_id,
    patchName: resource.patch.name,
    created: String(resource.created),
    user: {
      id: resource.user.id,
      name: resource.user.name,
      avatar: resource.user.avatar,
      patchCount: resource.user._count.patch_resource,
      role: resource.user.role
    }
  }))

  const response: HomeResponse = { galgames, resources }

  if (cached.canWrite) {
    await setHomeCache(cacheKey, response)
  }

  return response
}
