import { kunMoyuMoe } from '~/config/moyu-moe'
import { convert } from 'html-to-text'
import { getPatchPageTitle } from '~/utils/patch/getPatchPageTitle'
import { generateNullMetadata } from '~/utils/noIndex'
import type { Metadata } from 'next'
import type { Patch, PatchIntroduction } from '~/types/api/patch'

export const generateKunMetadataTemplate = (
  patch: Patch,
  intro: PatchIntroduction,
  nsfwAllowed: boolean
): Metadata => {
  const pageTitle = getPatchPageTitle(patch)

  if (patch.contentLimit === 'nsfw' && !nsfwAllowed) {
    return generateNullMetadata('')
  }

  return {
    title: pageTitle,
    keywords: [patch.name, ...patch.alias],
    authors: kunMoyuMoe.author,
    creator: patch.user.name,
    publisher: patch.user.name,
    description: convert(intro.introduction, {
      wordwrap: false,
      selectors: [{ selector: 'p', format: 'inline' }]
    }).slice(0, 170),
    openGraph: {
      title: patch.alias.length
        ? `${patch.name} | ${patch.alias[0]}`
        : `${patch.name}`,
      description: convert(intro.introduction).slice(0, 170),
      type: 'article',
      publishedTime: patch.created,
      modifiedTime: patch.updated,
      images: [
        {
          url: patch.banner,
          width: 1920,
          height: 1080,
          alt: patch.name
        }
      ]
    },
    twitter: {
      card: 'summary',
      title: patch.alias.length
        ? `${patch.name} | ${patch.alias[0]}`
        : `${patch.name}`,
      description: convert(intro.introduction).slice(0, 170),
      images: [patch.banner]
    },
    alternates: {
      canonical: `${kunMoyuMoe.domain.main}/${patch.uniqueId}`
    }
  }
}
