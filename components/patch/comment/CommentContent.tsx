'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@heroui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { createRoot } from 'react-dom/client'
import DOMPurify from 'isomorphic-dompurify'
import dynamic from 'next/dynamic'
import { useMounted } from '~/hooks/useMounted'
import { KunExternalLink } from '~/components/kun/external-link/ExternalLink'
import {
  SAFE_MEDIA_PROTOCOLS,
  sanitizeUserHref,
  sanitizeUserUrl
} from '~/utils/safeUrl'
import type { PatchComment } from '~/types/api/patch'

const KunPlyr = dynamic(
  () =>
    import('~/components/kun/milkdown/plugins/components/video/Plyr').then(
      (mod) => mod.KunPlyr
    ),
  { ssr: false }
)

interface Props {
  comment: PatchComment
}

const COMMENT_IMAGE_MAX_HEIGHT_REM = 24
const DEFAULT_LINE_HEIGHT_PX = 28
const DEFAULT_COLLAPSED_MAX_HEIGHT =
  COMMENT_IMAGE_MAX_HEIGHT_REM * 16 + DEFAULT_LINE_HEIGHT_PX

const VIDEO_DIV_REGEX =
  /<div\b(?=[^>]*\bdata-video-player\b)(?=[^>]*\bdata-src="([^"]*)")[^>]*>\s*<\/div>/gi

const decodeHtmlEntities = (value: string) => {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = value
  return textarea.value
}

type Segment =
  | { kind: 'html'; key: string; html: string }
  | { kind: 'video'; key: string; src: string }

const splitVideoSegments = (html: string): Segment[] => {
  const segments: Segment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  VIDEO_DIV_REGEX.lastIndex = 0
  let index = 0
  while ((match = VIDEO_DIV_REGEX.exec(html)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        kind: 'html',
        key: `h-${index}`,
        html: html.slice(lastIndex, match.index)
      })
      index += 1
    }
    const rawSrc = decodeHtmlEntities(match[1] ?? '')
    const safeSrc = sanitizeUserUrl(rawSrc, SAFE_MEDIA_PROTOCOLS)
    if (safeSrc) {
      segments.push({
        kind: 'video',
        key: `v-${index}-${safeSrc}`,
        src: safeSrc
      })
      index += 1
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < html.length) {
    segments.push({
      kind: 'html',
      key: `h-${index}`,
      html: html.slice(lastIndex)
    })
  }
  if (segments.length === 0) {
    segments.push({ kind: 'html', key: 'h-0', html })
  }
  return segments
}

export const CommentContent = ({ comment }: Props) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const previousContentRef = useRef(comment.content)
  const isMounted = useMounted()
  const [sanitizedContent, setSanitizedContent] = useState(() =>
    DOMPurify.sanitize(comment.content)
  )
  const [collapsedMaxHeight, setCollapsedMaxHeight] = useState(
    DEFAULT_COLLAPSED_MAX_HEIGHT
  )
  const [isExpanded, setIsExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)

  const segments = useMemo(
    () => splitVideoSegments(sanitizedContent),
    [sanitizedContent]
  )
  const hasVideo = useMemo(
    () => segments.some((s) => s.kind === 'video'),
    [segments]
  )

  useEffect(() => {
    if (previousContentRef.current === comment.content) {
      return
    }

    previousContentRef.current = comment.content
    setSanitizedContent(DOMPurify.sanitize(comment.content))
    setIsExpanded(false)
  }, [comment.content])

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
      const safeHref = href ? sanitizeUserHref(href) : null
      if (!text || !safeHref) {
        return
      }
      const root = document.createElement('div')
      root.className = element.className
      element.replaceWith(root)
      const linkRoot = createRoot(root)
      linkRoot.render(<KunExternalLink link={safeHref}>{text}</KunExternalLink>)
    })
  }, [segments, isMounted])

  useLayoutEffect(() => {
    if (!contentRef.current || !isMounted) {
      return
    }

    const element = contentRef.current
    const rootFontSize =
      Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize
      ) || 16
    const lineHeight =
      Number.parseFloat(window.getComputedStyle(element).lineHeight) ||
      DEFAULT_LINE_HEIGHT_PX
    const nextCollapsedMaxHeight =
      COMMENT_IMAGE_MAX_HEIGHT_REM * rootFontSize + lineHeight

    setCollapsedMaxHeight(nextCollapsedMaxHeight)

    const updateOverflowState = () => {
      setIsOverflowing(element.scrollHeight > nextCollapsedMaxHeight + 8)
    }

    const frameId = window.requestAnimationFrame(updateOverflowState)
    const images = Array.from(element.querySelectorAll('img'))
    images.forEach((img) => {
      img.addEventListener('load', updateOverflowState)
    })

    const trackedVideos = new WeakSet<HTMLVideoElement>()
    const trackVideos = () => {
      element.querySelectorAll('video').forEach((video) => {
        if (trackedVideos.has(video)) return
        trackedVideos.add(video)
        video.addEventListener('loadedmetadata', updateOverflowState, {
          once: true
        })
      })
    }
    trackVideos()

    const mutationObserver = new MutationObserver(() => {
      trackVideos()
      updateOverflowState()
    })
    mutationObserver.observe(element, { childList: true, subtree: true })

    return () => {
      window.cancelAnimationFrame(frameId)
      images.forEach((img) => {
        img.removeEventListener('load', updateOverflowState)
      })
      mutationObserver.disconnect()
    }
  }, [segments, isMounted])

  useEffect(() => {
    if (!isOverflowing) {
      setIsExpanded(false)
    }
  }, [isOverflowing])

  return (
    <div className="space-y-2">
      <div className="relative">
        <div
          ref={contentRef}
          className={`kun-prose kun-comment-content max-w-none overflow-hidden transition-all duration-300 ease-in-out`}
          style={
            isExpanded ? undefined : { maxHeight: `${collapsedMaxHeight}px` }
          }
        >
          {hasVideo ? (
            segments.map((segment) =>
              segment.kind === 'video' ? (
                <div
                  key={segment.key}
                  className="w-full my-4 overflow-hidden shadow-lg rounded-xl"
                >
                  <KunPlyr src={segment.src} />
                </div>
              ) : (
                <div
                  key={segment.key}
                  dangerouslySetInnerHTML={{ __html: segment.html }}
                />
              )
            )
          ) : (
            <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
          )}
        </div>

        {isOverflowing && !isExpanded && (
          <div className="pointer-events-none absolute bottom-0 left-0 h-12 w-full bg-gradient-to-t from-content1 to-transparent" />
        )}
      </div>

      {isOverflowing && (
        <Button
          variant="light"
          color="primary"
          className="mt-1 px-2 py-1 text-sm"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="mr-1 size-4" />
              收起评论
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 size-4" />
              展开评论
            </>
          )}
        </Button>
      )}
    </div>
  )
}
