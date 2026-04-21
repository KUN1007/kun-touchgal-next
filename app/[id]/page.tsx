import { PatchHeaderContainer } from '~/components/patch/header/Container'
import { ErrorComponent } from '~/components/error/ErrorComponent'
import { generateKunMetadataTemplate } from './metadata'
import {
  kunGetPatchPageDataActions,
  kunUpdatePatchViewsActions
} from './actions'
import { verifyHeaderCookie } from '~/utils/actions/verifyHeaderCookie'
import { getNSFWHeader } from '~/utils/actions/getNSFWHeader'
import { after } from 'next/server'
import type { Metadata } from 'next'

export const revalidate = 120

const isNsfwAllowed = (nsfwHeader: { content_limit?: string }) =>
  nsfwHeader.content_limit !== 'sfw'

interface Props {
  params: Promise<{ id: string }>
}

export const generateMetadata = async ({
  params
}: Props): Promise<Metadata> => {
  const { id } = await params
  const [pageData, nsfwHeader] = await Promise.all([
    kunGetPatchPageDataActions({ uniqueId: id }),
    getNSFWHeader()
  ])
  if (typeof pageData === 'string') {
    return {}
  }

  return generateKunMetadataTemplate(
    pageData.patch,
    pageData.intro,
    isNsfwAllowed(nsfwHeader)
  )
}

export default async function Kun({ params }: Props) {
  const { id } = await params
  if (!id) {
    return <ErrorComponent error={'提取页面参数错误'} />
  }

  const [pageData, payload, nsfwHeader] = await Promise.all([
    kunGetPatchPageDataActions({ uniqueId: id }),
    verifyHeaderCookie(),
    getNSFWHeader()
  ])
  const nsfwAllowed = isNsfwAllowed(nsfwHeader)
  if (typeof pageData === 'string') {
    return <ErrorComponent error={pageData} />
  }

  after(() => kunUpdatePatchViewsActions({ uniqueId: id }))

  return (
    <div className="container py-6 mx-auto space-y-6">
      <PatchHeaderContainer
        patch={pageData.patch}
        intro={pageData.intro}
        uid={payload?.uid}
        nsfwAllowed={nsfwAllowed}
      />
    </div>
  )
}
