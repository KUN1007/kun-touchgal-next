import { createHash, randomUUID } from 'crypto'
import {
  PATCH_RESOURCE_DETAIL_CACHE_DURATION,
  PATCH_RESOURCE_DETAIL_VERSION_DURATION
} from '~/config/cache'
import { delKv, getKv, setKv, setKvIfAbsent } from '~/lib/redis'
import type { PatchResource } from '~/types/api/patch'

const PATCH_RESOURCE_DETAIL_CACHE_KEY_PREFIX = 'patch:resource:detail'
// 本缓存装 status=0 的全部 section (get.ts 的公开查询不按 section 过滤), 而资源列表
// 只列 section='patch', 故版本号不复用列表的任何全局键 (复用全站 stats 版本会让任一
// 下载/点赞冲掉全站详情缓存); 版本键按 patch 分片, 失效信号与缓存键同粒度,
// A 补丁的写入不冲掉 B 补丁的缓存
const patchResourceDetailVersionKey = (patchId: number) =>
  `patch:resource:detail:version:${patchId}`

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

// 任何改动该 patch 下 status=0 资源的 mutation (不分 section, 含点赞/下载计数)
// 须在提交后调用; 版本号一变, 对应缓存键自动失效。section='patch' 的变更另需调用
// invalidateResourceListCache
export const invalidatePatchResourceDetailCache = async (patchId: number) => {
  try {
    await setKv(
      patchResourceDetailVersionKey(patchId),
      randomUUID(),
      PATCH_RESOURCE_DETAIL_VERSION_DURATION
    )
  } catch (error) {
    logPatchResourceDetailCacheError(
      'Failed to invalidate patch resource detail cache:',
      error
    )
  }
}

export const getPatchResourceDetailCacheKey = async (patchId: number) => {
  let version = '0'

  try {
    version = (await getKv(patchResourceDetailVersionKey(patchId))) ?? version
  } catch (error) {
    logPatchResourceDetailCacheError(
      'Failed to read patch resource detail cache version:',
      error
    )
    return null
  }

  const parts = [version, String(patchId)].join('|')
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
