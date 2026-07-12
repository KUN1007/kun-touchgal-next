import { prisma } from '~/prisma/index'
import {
  acquireKvLock,
  delKv,
  getKv,
  releaseKvLock,
  setKv,
  setKvIfAbsent
} from '~/lib/redis'
import { HOME_CACHE_DURATION } from '~/config/cache'
import {
  GalgameCardSelectField,
  toGalgameCardCount
} from '~/constants/api/select'
import { buildVisibilityCacheKey } from '../utils/visibilityCacheKey'
import {
  getResourceVisibilityWhere,
  type KunViewer
} from '~/app/api/utils/contentVisibility'
import type { Prisma } from '~/prisma/generated/prisma/client'
import type { HomeResource } from '~/types/api/home'

const HOME_CACHE_KEY_PREFIX = 'home:v2'
const HOME_CACHE_LOCK_TTL_SECONDS = 10
const HOME_CACHE_LOCK_RETRY_COUNT = 3
const HOME_CACHE_LOCK_RETRY_DELAY_MS = 150

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

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

const queryHomeData = async (
  visibilityWhere: Prisma.patchWhereInput,
  statusWhere: Prisma.patch_resourceWhereInput
): Promise<HomeResponse> => {
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
      avatar: resource.user.avatar,
      patchCount: resource.user._count.patch_resource,
      role: resource.user.role
    }
  }))

  return { galgames, resources }
}

const setHomeCacheIfAbsent = async (
  cacheKey: string,
  response: HomeResponse
) => {
  try {
    await setKvIfAbsent(cacheKey, JSON.stringify(response), HOME_CACHE_DURATION)
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

  // 共享缓存路径按公开视角查询, 避免 viewer 相关内容写入缓存
  const statusWhere = bypassCache
    ? getResourceVisibilityWhere(viewer)
    : { status: 0 }

  if (!cached.canWrite) {
    return queryHomeData(visibilityWhere, statusWhere)
  }

  // 单飞: 缓存未命中时仅持锁者查库回写, 其余请求短暂等待后重读缓存
  const lockKey = `${cacheKey}:lock`
  let lockToken: string | null
  try {
    lockToken = await acquireKvLock(lockKey, HOME_CACHE_LOCK_TTL_SECONDS)
  } catch (error) {
    // Redis 异常不同于锁竞争, 直接落库, 不进入等待循环
    logHomeCacheError('Failed to acquire home cache lock:', error)
    return queryHomeData(visibilityWhere, statusWhere)
  }

  if (!lockToken) {
    for (let i = 0; i < HOME_CACHE_LOCK_RETRY_COUNT; i++) {
      await sleep(HOME_CACHE_LOCK_RETRY_DELAY_MS)
      const retried = await getCachedHomeData(cacheKey)
      if (retried.response) {
        return retried.response
      }
    }
    // 等待超时 (持锁者异常或查询过慢), 直接落库保证首页可用,
    // 并以 NX 回写补位缺席的持锁者, 避免锁 TTL 内缓存持续为空
    const response = await queryHomeData(visibilityWhere, statusWhere)
    void setHomeCacheIfAbsent(cacheKey, response)
    return response
  }

  try {
    const response = await queryHomeData(visibilityWhere, statusWhere)
    await setHomeCache(cacheKey, response)
    return response
  } finally {
    // 锁有 TTL 自愈且释放带 token 校验, 无需阻塞响应等待释放
    void releaseKvLock(lockKey, lockToken).catch(() => undefined)
  }
}
