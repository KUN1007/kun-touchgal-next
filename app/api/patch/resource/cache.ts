import { createHash, randomUUID } from 'crypto'
import { PATCH_RESOURCE_DETAIL_CACHE_DURATION } from '~/config/cache'
import { delKv, getKv, getKvs, setKv, setKvIfAbsent } from '~/lib/redis'
import { RESOURCE_LIST_CACHE_STATS_VERSION_KEY } from '~/app/api/resource/cache'
import type { PatchResource } from '~/types/api/patch'

const PATCH_RESOURCE_DETAIL_CACHE_KEY_PREFIX = 'patch:resource:detail'
// 本缓存装 status=0 的全部 section (get.ts 的公开查询不按 section 过滤), 而资源列表
// 只列 section='patch', 故内容版本号不能复用列表的: galgame section 的变更不该失效
// 列表缓存, 却必须失效本缓存
const PATCH_RESOURCE_DETAIL_CACHE_CONTENT_VERSION_KEY =
  'patch:resource:detail:version:content'

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

// 任何改动 status=0 资源的 mutation 须在提交后调用 (不分 section); 版本号一变, 本 key
// 自动失效。section='patch' 的变更另需调用 invalidateResourceListCache
export const invalidatePatchResourceDetailCache = async () => {
  try {
    await setKv(PATCH_RESOURCE_DETAIL_CACHE_CONTENT_VERSION_KEY, randomUUID())
  } catch (error) {
    logPatchResourceDetailCacheError(
      'Failed to invalidate patch resource detail cache:',
      error
    )
  }
}

// 内容版本号自持, 统计版本号复用资源列表的: 点赞/下载两处写路径无 section 闸门,
// 递增 stats 版本即可同时失效本缓存内嵌的 likeCount / download
export const getPatchResourceDetailCacheKey = async (patchId: number) => {
  let contentVersion = '0'
  let statsVersion = '0'

  try {
    const versions = await getKvs([
      PATCH_RESOURCE_DETAIL_CACHE_CONTENT_VERSION_KEY,
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
