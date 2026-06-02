'use client'

import { useEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Card, CardBody } from '@heroui/card'
import dynamic from 'next/dynamic'
import { Info } from './Info'
import { PatchTag } from './Tag'
import { PatchCompany } from './Company'
import {
  SAFE_MEDIA_PROTOCOLS,
  getHttpUrlHostname,
  isHostnameExcluded,
  isRedirectableUrl,
  sanitizeUserHref,
  sanitizeUserUrl
} from '~/utils/safeUrl'
import { useUserStore } from '~/store/userStore'
import type { PatchIntroduction } from '~/types/api/patch'

import './_adjust.scss'

const KunPlyr = dynamic(
  () =>
    import('~/components/kun/milkdown/plugins/components/video/Plyr').then(
      (mod) => mod.KunPlyr
    ),
  { ssr: false }
)

type ExternalLinkNavigation = {
  href: string
  shouldOpenExternal: boolean
}

const getExternalLinkNavigation = (
  href: string
): ExternalLinkNavigation | null => {
  const safeHref = sanitizeUserHref(href)
  if (!safeHref) {
    return null
  }

  const { enableRedirect, excludedDomains } = useUserStore.getState().user
  const hostname = getHttpUrlHostname(safeHref)
  const isExcludedDomain = hostname
    ? isHostnameExcluded(hostname, excludedDomains)
    : false
  const shouldRedirect =
    !isExcludedDomain && enableRedirect && isRedirectableUrl(safeHref)

  return {
    href: shouldRedirect
      ? `/redirect?url=${encodeURIComponent(safeHref)}`
      : safeHref,
    shouldOpenExternal: !enableRedirect && isRedirectableUrl(safeHref)
  }
}

const getClosestVideoPlayer = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return null
  }

  const element = target.closest('[data-video-player]')
  return element instanceof HTMLElement ? element : null
}

const getClosestExternalLink = (
  target: EventTarget | null,
  content: HTMLElement
) => {
  if (!(target instanceof Element)) {
    return null
  }

  const anchor = target.closest('a[data-kun-external-link]')
  return anchor instanceof HTMLAnchorElement && content.contains(anchor)
    ? anchor
    : null
}

const scheduleRootUnmount = (root: Root) => {
  window.setTimeout(() => {
    root.unmount()
  }, 0)
}

const VideoLoadingPlaceholder = () => (
  <>
    <div className="absolute inset-0 bg-black" />
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00b3ff] shadow-lg">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      </div>
    </div>
  </>
)

const LazyKunPlyr = ({ src, autoPlay }: { src: string; autoPlay: boolean }) => {
  const [isReady, setIsReady] = useState(false)

  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-black">
      {!isReady && <VideoLoadingPlaceholder />}
      <div
        className={`absolute inset-0 [&_.plyr]:h-full [&_.plyr]:w-full [&_.plyr__video-wrapper]:h-full [&_video]:h-full [&_video]:w-full ${
          isReady ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <KunPlyr
          src={src}
          autoPlay={autoPlay}
          onReady={() => setIsReady(true)}
        />
      </div>
    </div>
  )
}

interface Props {
  intro: PatchIntroduction
  patchId: number
  uid?: number
}

export const IntroductionTab = ({ intro, patchId, uid }: Props) => {
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const content = contentRef.current
    if (!content) {
      return
    }

    const videoRoots = new Map<HTMLElement, Root>()

    const mountVideoPlayer = (element: HTMLElement) => {
      if (
        !content.contains(element) ||
        element.hasAttribute('data-video-loaded')
      ) {
        return
      }

      const src = element.getAttribute('data-src')
      const safeSrc = src ? sanitizeUserUrl(src, SAFE_MEDIA_PROTOCOLS) : null
      if (!safeSrc) {
        return
      }

      const rootElement = document.createElement('div')
      rootElement.className = 'w-full'
      element.setAttribute('data-video-loaded', '')
      element.removeAttribute('role')
      element.removeAttribute('tabindex')
      element.replaceChildren(rootElement)

      const root = createRoot(rootElement)
      videoRoots.set(element, root)
      root.render(<LazyKunPlyr src={safeSrc} autoPlay />)
    }

    const applyExternalLinkNavigation = (anchor: HTMLAnchorElement) => {
      const href =
        anchor.getAttribute('data-href') || anchor.getAttribute('href')
      const navigation = href ? getExternalLinkNavigation(href) : null
      if (!navigation) {
        anchor.removeAttribute('href')
        anchor.removeAttribute('target')
        anchor.removeAttribute('rel')
        return false
      }

      anchor.setAttribute('href', navigation.href)
      if (navigation.shouldOpenExternal) {
        anchor.setAttribute('target', '_blank')
        anchor.setAttribute('rel', 'noopener noreferrer')
      } else {
        anchor.removeAttribute('target')
        anchor.removeAttribute('rel')
      }

      return true
    }

    const handleExternalLinkPrepare = (event: Event) => {
      const anchor = getClosestExternalLink(event.target, content)
      if (anchor) {
        applyExternalLinkNavigation(anchor)
      }
    }

    const handleExternalLinkClick = (event: MouseEvent) => {
      const anchor = getClosestExternalLink(event.target, content)
      if (anchor && !applyExternalLinkNavigation(anchor)) {
        event.preventDefault()
      }
    }

    const handleVideoClick = (event: MouseEvent) => {
      const element = getClosestVideoPlayer(event.target)
      if (element) {
        mountVideoPlayer(element)
      }
    }

    const handleVideoKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      const element = getClosestVideoPlayer(event.target)
      if (!element || element.hasAttribute('data-video-loaded')) {
        return
      }

      event.preventDefault()
      mountVideoPlayer(element)
    }

    content.addEventListener('pointerdown', handleExternalLinkPrepare)
    content.addEventListener('contextmenu', handleExternalLinkPrepare)
    content.addEventListener('focusin', handleExternalLinkPrepare)
    content.addEventListener('click', handleExternalLinkClick)
    content.addEventListener('click', handleVideoClick)
    content.addEventListener('keydown', handleVideoKeyDown)

    return () => {
      content.removeEventListener('pointerdown', handleExternalLinkPrepare)
      content.removeEventListener('contextmenu', handleExternalLinkPrepare)
      content.removeEventListener('focusin', handleExternalLinkPrepare)
      content.removeEventListener('click', handleExternalLinkClick)
      content.removeEventListener('click', handleVideoClick)
      content.removeEventListener('keydown', handleVideoKeyDown)
      videoRoots.forEach(scheduleRootUnmount)
      videoRoots.clear()
    }
  }, [intro.introduction])

  return (
    <Card className="p-1 sm:p-8">
      <CardBody className="p-4 space-y-6">
        <div
          ref={contentRef}
          dangerouslySetInnerHTML={{ __html: intro.introduction }}
          className="kun-prose max-w-none"
        />

        {/* <div className="mt-4">
          <h3 className="mb-4 text-xl font-medium">游戏制作商</h3>
        </div> */}

        {uid && <PatchTag patchId={patchId} initialTags={intro.tag} />}

        <PatchCompany
          patchId={patchId}
          initialCompanies={intro.company}
          vndbId={intro.vndbId}
        />

        <Info intro={intro} />
      </CardBody>
    </Card>
  )
}
