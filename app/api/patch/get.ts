import { z } from 'zod'
import {
  buildCachedPatch,
  getCachedPatchContent,
  setCachedPatchContent,
  withPatchFavoriteStatus
} from './_content'
import { getPatchSummaryByUniqueId } from './_queries'
import type { KunViewer } from '~/app/api/utils/contentVisibility'

const uniqueIdSchema = z.object({
  uniqueId: z.string().min(8).max(8)
})

export const getPatchById = async (
  input: z.infer<typeof uniqueIdSchema>,
  viewer: KunViewer | null
) => {
  const uid = viewer?.uid ?? 0
  const cachedPatch = await getCachedPatchContent(input.uniqueId)
  if (cachedPatch) {
    return withPatchFavoriteStatus(input.uniqueId, cachedPatch, uid)
  }

  const { uniqueId } = input

  const patch = await getPatchSummaryByUniqueId(uniqueId)

  if (!patch) {
    return '未找到对应 Galgame'
  }

  const response = buildCachedPatch(patch)
  await setCachedPatchContent(input.uniqueId, response)

  return withPatchFavoriteStatus(input.uniqueId, response, uid)
}
