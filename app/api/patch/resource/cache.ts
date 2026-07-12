import { createHash } from 'crypto'
import { PATCH_RESOURCE_DETAIL_CACHE_DURATION } from '~/config/cache'
import { delKv, getKv, getKvs, setKv, setKvIfAbsent } from '~/lib/redis'
import {
  RESOURCE_LIST_CACHE_CONTENT_VERSION_KEY,
  RESOURCE_LIST_CACHE_STATS_VERSION_KEY
} from '~/app/api/resource/cache'
import type { PatchResource } from '~/types/api/patch'

const PATCH_RESOURCE_DETAIL_CACHE_KEY_PREFIX = 'patch:resource:detail'

const logPatchResourceDetailCacheError = (message: string, error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(message, error)
}

const deletePatchResourceDetailCache = async (cacheKey: string) => {
  try {
    await delKv(cacheKey)
  } catch (error) {
    logPatchResourceDetailCacheError(
      'Failed to delete invalid patch resource detail cache:',
      error
    )
  }
}

// 复用资源列表的内容/统计版本号: 任何改动 patch 资源的 mutation 已在写路径
// 调用 invalidateResourceListCache / invalidateResourceStatsListCache, 版本号
// 一变, 本 key 自动失效, 无需额外布线
export const getPatchResourceDetailCacheKey = async (patchId: number) => {
  let contentVersion = '0'
  let statsVersion = '0'

  try {
    const versions = await getKvs([
      RESOURCE_LIST_CACHE_CONTENT_VERSION_KEY,
      RESOURCE_LIST_CACHE_STATS_VERSION_KEY
    ])
    contentVersion = versions[0] ?? contentVersion
    statsVersion = versions[1] ?? statsVersion
  } catch (error) {
    logPatchResourceDetailCacheError(
      'Failed to read patch resource detail cache version:',
      error
    )
    return null
  }

  const parts = [contentVersion, statsVersion, String(patchId)].join('|')
  const hash = createHash('sha1').update(parts).digest('hex').slice(0, 16)
  return `${PATCH_RESOURCE_DETAIL_CACHE_KEY_PREFIX}:${hash}`
}

export const getCachedPatchResourceDetail = async (cacheKey: string | null) => {
  if (!cacheKey) {
    return { response: null, canWrite: false }
  }

  let cached: string | null

  try {
    cached = await getKv(cacheKey)
  } catch (error) {
    logPatchResourceDetailCacheError(
      'Failed to read patch resource detail cache:',
      error
    )
    return { response: null, canWrite: false }
  }

  if (!cached) {
    return { response: null, canWrite: true }
  }

  try {
    return {
      response: JSON.parse(cached) as PatchResource[],
      canWrite: true
    }
  } catch (error) {
    logPatchResourceDetailCacheError(
      'Failed to parse patch resource detail cache:',
      error
    )
    await deletePatchResourceDetailCache(cacheKey)
    return { response: null, canWrite: true }
  }
}

export const setPatchResourceDetailCache = async (
  cacheKey: string,
  response: PatchResource[]
) => {
  try {
    await setKv(
      cacheKey,
      JSON.stringify(response),
      PATCH_RESOURCE_DETAIL_CACHE_DURATION
    )
  } catch (error) {
    logPatchResourceDetailCacheError(
      'Failed to write patch resource detail cache:',
      error
    )
  }
}

export const setPatchResourceDetailCacheIfAbsent = async (
  cacheKey: string,
  response: PatchResource[]
) => {
  try {
    await setKvIfAbsent(
      cacheKey,
      JSON.stringify(response),
      PATCH_RESOURCE_DETAIL_CACHE_DURATION
    )
  } catch (error) {
    logPatchResourceDetailCacheError(
      'Failed to write patch resource detail cache:',
      error
    )
  }
}
