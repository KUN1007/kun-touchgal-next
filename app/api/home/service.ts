import { prisma } from '~/prisma/index'
import { delKv, getKv, setKv } from '~/lib/redis'
import { HOME_CACHE_DURATION } from '~/config/cache'
import {
  GalgameCardSelectField,
  toGalgameCardCount
} from '~/constants/api/select'
import { buildVisibilityCacheKey } from '../utils/visibilityCacheKey'
import {
  getResourceShadowBanWhere,
  maskShadowBannedUser,
  type KunViewer
} from '~/app/api/utils/shadowBan'
import type { Prisma } from '~/prisma/generated/prisma/client'
import type { HomeResource } from '~/types/api/home'

const HOME_CACHE_KEY_PREFIX = 'home:v2'

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
  visibilityWhere: Prisma.patchWhereInput,
  viewer: KunViewer | null,
  bypassCache: boolean
): Promise<HomeResponse> => {
  const cacheKey = getHomeCacheKey(visibilityWhere)

  const cached = bypassCache
    ? { response: null, canWrite: false }
    : await getCachedHomeData(cacheKey)
  if (cached.response) {
    return cached.response
  }

  // 共享缓存路径按公开视角查询与 mask, 避免 viewer 相关内容写入缓存
  const maskViewer = bypassCache ? viewer : null
  const statusWhere = bypassCache
    ? getResourceShadowBanWhere(viewer)
    : { status: 0 }

  const [data, resourcesData] = await Promise.all([
    prisma.patch.findMany({
      orderBy: { created: 'desc' },
      where: visibilityWhere,
      select: GalgameCardSelectField,
      take: 20
    }),
    prisma.patch_resource.findMany({
      orderBy: { created: 'desc' },
      where: { patch: visibilityWhere, section: 'patch', ...statusWhere },
      select: {
        id: true,
        name: true,
        section: true,
        type: true,
        language: true,
        platform: true,
        download: true,
        patch_id: true,
        created: true,
        patch: {
          select: {
            name: true,
            unique_id: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            avatar_shadow_ban: true,
            bio_shadow_ban: true,
            role: true,
            _count: {
              select: { patch_resource: true }
            }
          }
        },
        links: {
          orderBy: { sort_order: 'asc' },
          take: 1,
          select: {
            size: true
          }
        },
        _count: {
          select: {
            like_by: true,
            links: true
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
    platform: resource.platform,
    primaryLink: resource.links[0] ? { size: resource.links[0].size } : null,
    linkCount: resource._count.links,
    likeCount: resource._count.like_by,
    download: resource.download,
    patchId: resource.patch_id,
    patchName: resource.patch.name,
    created: String(resource.created),
    user: {
      id: resource.user.id,
      name: resource.user.name,
      avatar: maskShadowBannedUser(maskViewer, resource.user).avatar,
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
