'use client'

import { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import DOMPurify from 'isomorphic-dompurify'
import { Card, CardBody } from '@heroui/card'
import { Info } from './Info'
import { PatchTag } from './Tag'
import dynamic from 'next/dynamic'
import { useMounted } from '~/hooks/useMounted'
import { KunLink } from '~/components/kun/milkdown/plugins/components/link/KunLink'
import { KunExternalLink } from '~/components/kun/external-link/ExternalLink'
import type { PatchIntroduction } from '~/types/api/patch'

// @ts-expect-error
import './_adjust.scss'
import { PatchCompany } from './Company'

const KunPlyr = dynamic(
  () =>
    import('~/components/kun/milkdown/plugins/components/video/Plyr').then(
      (mod) => mod.KunPlyr
    ),
  { ssr: false }
)

interface Props {
  intro: PatchIntroduction
  patchId: number
  uid?: number
}

export const IntroductionTab = ({ intro, patchId, uid }: Props) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const isMounted = useMounted()

  useEffect(() => {
    if (!contentRef.current || !isMounted) {
      return
    }

    const externalLinkElements = contentRef.current.querySelectorAll(
      '[data-kun-external-link]'
    )
    externalLinkElements.forEach((element) => {
      const text = element.getAttribute('data-text')
      const href = element.getAttribute('data-href')
      if (!text || !href) {
        return
      }
      const root = document.createElement('div')
      root.className = element.className
      element.replaceWith(root)
      const videoRoot = createRoot(root)
      videoRoot.render(<KunExternalLink link={href}>{text}</KunExternalLink>)
    })

    const videoElements = contentRef.current.querySelectorAll(
      '[data-video-player]'
    )
    videoElements.forEach((element) => {
      const src = element.getAttribute('data-src')
      if (!src) {
        return
      }
      const root = document.createElement('div')
      root.className = element.className
      element.replaceWith(root)
      const videoRoot = createRoot(root)
      videoRoot.render(<KunPlyr src={src} />)
    })

    const linkElements = contentRef.current.querySelectorAll('[data-kun-link]')
    linkElements.forEach((element) => {
      const href = element.getAttribute('data-href')
      const text = element.getAttribute('data-text')
      if (!href || !text) return

      const root = document.createElement('div')
      root.className = element.className
      element.replaceWith(root)

      const linkRoot = ReactDOM.createRoot(root)
      linkRoot.render(<KunLink href={href} text={text} />)
    })
  }, [isMounted])

  return (
    <Card className="p-1 sm:p-8">
      <CardBody className="p-4 space-y-6">
        <div
          ref={contentRef}
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(intro.introduction)
          }}
          className="kun-prose max-w-none"
        />

        {/* <div className="mt-4">
          <h3 className="mb-4 text-xl font-medium">游戏制作商</h3>
        </div> */}

        {uid && <PatchTag patchId={patchId} initialTags={intro.tag} />}

        <PatchCompany patchId={patchId} initialCompanies={intro.company} />

        <Info intro={intro} />
      </CardBody>
    </Card>
  )
}
