import { z } from 'zod'
import {
  buildCachedPatch,
  getCachedPatchContent,
  restorePatchUserAvatarForViewer,
  setCachedPatchContent,
  withPatchFavoriteStatus
} from './_content'
import { getPatchSummaryByUniqueId } from './_queries'
import type { KunViewer } from '~/app/api/utils/shadowBan'

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
    const patchForViewer = await restorePatchUserAvatarForViewer(
      cachedPatch,
      viewer
    )
    return withPatchFavoriteStatus(input.uniqueId, patchForViewer, uid)
  }

  const { uniqueId } = input

  const patch = await getPatchSummaryByUniqueId(uniqueId)

  if (!patch) {
    return '未找到对应 Galgame'
  }

  const response = buildCachedPatch(patch)
  await setCachedPatchContent(input.uniqueId, response)

  const patchForViewer = await restorePatchUserAvatarForViewer(response, viewer)
  return withPatchFavoriteStatus(input.uniqueId, patchForViewer, uid)
}
