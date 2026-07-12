import { z } from 'zod'
import { kunCacheSingleflight } from '~/app/api/utils/cacheSingleflight'
import {
  PATCH_NOT_FOUND,
  buildCachedPatch,
  getCachedPatchContent,
  setCachedPatchContent,
  setCachedPatchContentIfAbsent,
  withPatchFavoriteStatus
} from './_content'
import { getPatchSummaryByUniqueId } from './_queries'
import { getPatchCacheKey } from './cache'
import type { KunViewer } from '~/app/api/utils/contentVisibility'

const uniqueIdSchema = z.object({
  uniqueId: z.string().min(8).max(8)
})

export const getPatchById = async (
  input: z.infer<typeof uniqueIdSchema>,
  viewer: KunViewer | null
) => {
  const uid = viewer?.uid ?? 0
  const { uniqueId } = input
  const cachedPatch = await getCachedPatchContent(uniqueId)
  if (cachedPatch) {
    return withPatchFavoriteStatus(uniqueId, cachedPatch, uid)
  }

  const patch = await kunCacheSingleflight({
    cacheKey: getPatchCacheKey(uniqueId),
    readCache: () => getCachedPatchContent(uniqueId),
    writeCache: async (response) => {
      if (response !== PATCH_NOT_FOUND) {
        await setCachedPatchContent(uniqueId, response)
      }
    },
    writeCacheIfAbsent: async (response) => {
      if (response !== PATCH_NOT_FOUND) {
        await setCachedPatchContentIfAbsent(uniqueId, response)
      }
    },
    query: async () => {
      const summary = await getPatchSummaryByUniqueId(uniqueId)
      return summary ? buildCachedPatch(summary) : PATCH_NOT_FOUND
    }
  })

  if (patch === PATCH_NOT_FOUND) {
    return '未找到对应 Galgame'
  }

  return withPatchFavoriteStatus(uniqueId, patch, uid)
}
