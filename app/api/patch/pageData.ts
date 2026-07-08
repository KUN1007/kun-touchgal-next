import { z } from 'zod'
import {
  buildCachedPatch,
  buildPatchIntroduction,
  getCachedPatchContent,
  getCachedPatchIntroduction,
  setCachedPatchContent,
  setCachedPatchIntroduction,
  withPatchFavoriteStatus
} from './_content'
import { getPatchPageContentByUniqueId } from './_queries'
import type { KunViewer } from '~/app/api/utils/contentVisibility'

const uniqueIdSchema = z.object({
  uniqueId: z.string().min(8).max(8)
})

export const getPatchPageData = async (
  input: z.infer<typeof uniqueIdSchema>,
  viewer: KunViewer | null
) => {
  const uid = viewer?.uid ?? 0
  const { uniqueId } = input
  const [cachedPatch, cachedIntro] = await Promise.all([
    getCachedPatchContent(uniqueId),
    getCachedPatchIntroduction(uniqueId)
  ])

  if (cachedPatch && cachedIntro) {
    return {
      patch: await withPatchFavoriteStatus(uniqueId, cachedPatch, uid),
      intro: cachedIntro
    }
  }

  const patchContent = await getPatchPageContentByUniqueId(uniqueId)
  if (!patchContent) {
    return '未找到对应 Galgame'
  }

  const patch = buildCachedPatch(patchContent)
  const intro = await buildPatchIntroduction(patchContent)
  await Promise.all([
    setCachedPatchContent(uniqueId, patch),
    setCachedPatchIntroduction(uniqueId, intro)
  ])

  return {
    patch: await withPatchFavoriteStatus(uniqueId, patch, uid),
    intro
  }
}
