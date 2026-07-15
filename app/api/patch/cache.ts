import { randomUUID } from 'crypto'
import { PATCH_FAVORITE_CACHE_DURATION } from '~/config/cache'
import { PATCH_INTRODUCTION_HTML_VERSION } from '~/app/api/utils/render/htmlVersion'
import { delKv, delKvs, getKv, getKvs, setKv } from '~/lib/redis'
import { prisma } from '~/prisma/index'

const PATCH_CACHE_KEY = 'patch'
const PATCH_INTRODUCTION_CACHE_KEY = 'patch:introduction'
const PATCH_FAVORITE_CACHE_KEY = 'patch:favorite'
const PATCH_FAVORITE_VERSION_KEY = 'patch:favorite:version'
const PATCH_FAVORITE_DEFAULT_VERSION = '0'

export const getPatchCacheKey = (uniqueId: string) =>
  `${PATCH_CACHE_KEY}:${uniqueId}`

export const getPatchIntroductionCacheKey = (uniqueId: string) =>
  `${PATCH_INTRODUCTION_CACHE_KEY}:v${PATCH_INTRODUCTION_HTML_VERSION}:${uniqueId}`

const getPatchFavoriteCacheKey = (uniqueId: string, uid: number) =>
  `${PATCH_FAVORITE_CACHE_KEY}:${uid}:${uniqueId}`

const getPatchFavoriteVersionKey = (uid: number) =>
  `${PATCH_FAVORITE_VERSION_KEY}:${uid}`

const getPatchFavoriteCacheVersion = async (uid: number) => {
  if (uid <= 0) {
    return PATCH_FAVORITE_DEFAULT_VERSION
  }

  return (
    (await getKv(getPatchFavoriteVersionKey(uid))) ??
    PATCH_FAVORITE_DEFAULT_VERSION
  )
}

const serializePatchFavoriteStatus = (version: string, isFavorite: boolean) =>
  `${version}:${isFavorite ? '1' : '0'}`

const parsePatchFavoriteStatus = (cachedStatus: string) => {
  if (cachedStatus === '1' || cachedStatus === '0') {
    return {
      version: PATCH_FAVORITE_DEFAULT_VERSION,
      isFavorite: cachedStatus === '1'
    }
  }

  const separatorIndex = cachedStatus.lastIndexOf(':')
  if (separatorIndex === -1) {
    return null
  }

  const version = cachedStatus.slice(0, separatorIndex)
  const status = cachedStatus.slice(separatorIndex + 1)
  if (!version || (status !== '1' && status !== '0')) {
    return null
  }

  return {
    version,
    isFavorite: status === '1'
  }
}

type PatchFavoriteCacheResult = {
  isFavorite: boolean | null
  version: string
}

export const getCachedPatchFavoriteStatus = async (
  uniqueId: string,
  uid: number
): Promise<PatchFavoriteCacheResult> => {
  if (uid <= 0) {
    return {
      isFavorite: false,
      version: PATCH_FAVORITE_DEFAULT_VERSION
    }
  }

  const [cachedStatus, currentVersion] = await getKvs([
    getPatchFavoriteCacheKey(uniqueId, uid),
    getPatchFavoriteVersionKey(uid)
  ])
  const version = currentVersion ?? PATCH_FAVORITE_DEFAULT_VERSION

  if (cachedStatus === null) {
    return {
      isFavorite: null,
      version
    }
  }

  const parsedStatus = parsePatchFavoriteStatus(cachedStatus)
  if (!parsedStatus || parsedStatus.version !== version) {
    return {
      isFavorite: null,
      version
    }
  }

  return {
    isFavorite: parsedStatus.isFavorite,
    version
  }
}

export const setCachedPatchFavoriteStatus = async (
  uniqueId: string,
  uid: number,
  isFavorite: boolean,
  version?: string
) => {
  if (uid <= 0) {
    return
  }

  const cacheVersion = version ?? (await getPatchFavoriteCacheVersion(uid))

  await setKv(
    getPatchFavoriteCacheKey(uniqueId, uid),
    serializePatchFavoriteStatus(cacheVersion, isFavorite),
    PATCH_FAVORITE_CACHE_DURATION
  )
}

export const invalidatePatchContentCache = async (uniqueId: string) => {
  await Promise.all([
    delKv(getPatchCacheKey(uniqueId)),
    delKv(getPatchIntroductionCacheKey(uniqueId))
  ])
}

// 只持有数字 patch_id 的写路径 (评分/评论统计变更) 用它失效补丁详情缓存:
// 详情缓存内嵌 ratingSummary 与 _count(评论/资源/收藏), 缓存键按 unique_id.
// 调用方须在事务提交后 best-effort 调用 (事务内失效会被并发读回填旧值, 见 M-04)
export const invalidatePatchContentCacheByPatchId = async (
  patchIds: number | number[]
) => {
  const ids = Array.isArray(patchIds) ? [...new Set(patchIds)] : [patchIds]
  if (!ids.length) {
    return
  }
  const patches = await prisma.patch.findMany({
    where: { id: { in: ids } },
    select: { unique_id: true }
  })
  await Promise.all(
    patches.map((patch) => invalidatePatchContentCache(patch.unique_id))
  )
}

export const invalidatePatchFavoriteCache = async (
  uniqueId: string,
  uid: number
) => {
  if (uid <= 0) {
    return
  }

  await delKv(getPatchFavoriteCacheKey(uniqueId, uid))
}

export const invalidatePatchFavoriteCaches = async (
  uniqueIds: string[],
  uid: number
) => {
  if (uid <= 0) {
    return
  }

  const cacheKeys = [...new Set(uniqueIds)].map((uniqueId) =>
    getPatchFavoriteCacheKey(uniqueId, uid)
  )
  await delKvs(cacheKeys)
}

export const bumpPatchFavoriteCacheVersion = async (uid: number) => {
  if (uid <= 0) {
    return
  }

  await setKv(getPatchFavoriteVersionKey(uid), randomUUID())
}
