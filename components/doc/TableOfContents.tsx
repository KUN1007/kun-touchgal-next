'use client'

import { useEffect, useState } from 'react'
import { ListTree } from 'lucide-react'
import { cn } from '~/utils/cn'
import { usePrioritizedWheelScroll } from './usePrioritizedWheelScroll'

interface TOCItem {
  id: string
  text: string
  level: number
}

const scrollToHeading = (id: string) => {
  const headingElement = document.getElementById(id)

  if (!headingElement) {
    return
  }

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches

  headingElement.scrollIntoView({
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
    block: 'start'
  })
}

export const TableOfContents = () => {
  const [headings, setHeadings] = useState<TOCItem[]>([])
  const [activeId, setActiveId] = useState('')
  const { containerRef: tableOfContentsRef, scrollContainerRef } =
    usePrioritizedWheelScroll<HTMLElement, HTMLUListElement>()

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll('article h1, article h2, article h3')
    )
      .map((element) => ({
        id: element.id,
        text: element.textContent || '',
        level: Number(element.tagName.charAt(1))
      }))
      .filter((heading) => heading.id && heading.text)

    setHeadings(elements)

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: '0px 0px -80% 0px' }
    )

    elements.forEach((heading) => {
      const element = document.getElementById(heading.id)

      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [])

  const minHeadingLevel = headings.reduce(
    (min, heading) => Math.min(min, heading.level),
    6
  )

  return (
    <nav
      ref={tableOfContentsRef}
      aria-label="本页面索引"
      className="sticky top-32 hidden h-[calc(100dvh-9rem)] w-64 shrink-0 self-start lg:block"
    >
      <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-default-200/70 bg-content1/80 p-4 shadow-sm backdrop-blur-xl">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <ListTree className="size-4 text-primary-500" aria-hidden="true" />
          <span>本页面索引</span>
        </h2>
        {headings.length > 0 ? (
          <ul
            ref={scrollContainerRef}
            className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 scrollbar-hide"
          >
            {headings.map((heading) => {
              const isActive = activeId === heading.id
              const depth = Math.min(
                Math.max(heading.level - minHeadingLevel, 0),
                2
              )
              const isTopLevel = depth === 0
              const isSecondLevel = depth === 1

              return (
                <li
                  key={heading.id}
                  style={{ marginLeft: `${depth * 0.875}rem` }}
                >
                  <a
                    href={`#${heading.id}`}
                    onClick={(event) => {
                      event.preventDefault()
                      scrollToHeading(heading.id)
                    }}
                    aria-current={isActive ? 'location' : undefined}
                    className={cn(
                      'group relative flex min-h-8 items-start gap-2 rounded-xl border-l-2 py-1.5 pl-3 pr-2 transition-colors duration-200 hover:border-primary-300 hover:bg-primary-500/5 hover:text-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 motion-reduce:transition-none',
                      isTopLevel
                        ? 'text-sm font-semibold'
                        : isSecondLevel
                          ? 'text-sm font-medium'
                          : 'text-xs font-normal',
                      isActive
                        ? 'border-primary-500 bg-primary-500/10 text-primary-500'
                        : isTopLevel
                          ? 'border-transparent text-default-700'
                          : isSecondLevel
                            ? 'border-transparent text-default-500'
                            : 'border-transparent text-default-400'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-1.5 shrink-0 rounded-full transition-colors duration-200 group-hover:bg-primary-300 motion-reduce:transition-none',
                        isTopLevel
                          ? 'size-2'
                          : isSecondLevel
                            ? 'mt-2 size-1.5'
                            : 'mt-2 size-1',
                        isActive
                          ? 'bg-primary-500'
                          : isTopLevel
                            ? 'bg-default-400'
                            : 'bg-default-300'
                      )}
                    />
                    <span className="min-w-0 flex-1 leading-5 line-clamp-2">
                      {heading.text}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="rounded-2xl bg-default-100/70 p-3 text-sm text-default-500">
            此页面暂无标题索引
          </p>
        )}
      </div>
    </nav>
  )
}
