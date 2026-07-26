import { kunMoyuMoe } from '~/config/moyu-moe'
import { convert } from 'html-to-text'
import { generateNullMetadata } from '~/utils/noIndex'
import { getResourcePageTitle } from '~/utils/patch/getResourcePageTitle'
import type { Metadata } from 'next'
import type { PatchResourceDetail } from '~/app/api/patch/resource/detail'

export const generateKunMetadataTemplate = (
  detail: PatchResourceDetail,
  nsfwAllowed: boolean
): Metadata => {
  if (detail.contentLimit === 'nsfw' && !nsfwAllowed) {
    return generateNullMetadata('')
  }

  const { resource } = detail
  const pageTitle = `${getResourcePageTitle(resource)} | ${detail.patchName}`
  const description = convert(resource.noteHtml, {
    wordwrap: false,
    selectors: [{ selector: 'p', format: 'inline' }]
  }).slice(0, 170)

  return {
    title: pageTitle,
    description,
    openGraph: {
      title: pageTitle,
      description,
      type: 'article'
    },
    twitter: {
      card: 'summary',
      title: pageTitle,
      description
    },
    alternates: {
      canonical: `${kunMoyuMoe.domain.main}/${resource.uniqueId}/resource/${resource.id}`
    }
  }
}
