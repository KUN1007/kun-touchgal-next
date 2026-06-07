'use client'

import { useEffect, useRef } from 'react'

const normalizeWheelDeltaY = (
  event: WheelEvent,
  scrollElement: HTMLElement
) => {
  if (event.deltaMode === 1) {
    return event.deltaY * 16
  }

  if (event.deltaMode === 2) {
    return event.deltaY * scrollElement.clientHeight
  }

  return event.deltaY
}

const scrollPageBy = (event: WheelEvent, deltaY: number) => {
  event.preventDefault()
  window.scrollBy(0, deltaY)
}

const handlePrioritizedWheelScroll = (
  event: WheelEvent,
  scrollElement: HTMLElement | null
) => {
  if (!scrollElement || event.ctrlKey) {
    return
  }

  const deltaY = normalizeWheelDeltaY(event, scrollElement)
  if (deltaY === 0) {
    return
  }

  const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight
  if (maxScrollTop <= 0) {
    scrollPageBy(event, deltaY)
    return
  }

  const currentScrollTop = scrollElement.scrollTop
  const nextScrollTop = Math.min(
    maxScrollTop,
    Math.max(0, currentScrollTop + deltaY)
  )

  if (nextScrollTop === currentScrollTop) {
    scrollPageBy(event, deltaY)
    return
  }

  event.preventDefault()
  scrollElement.scrollTop = nextScrollTop
}

export const usePrioritizedWheelScroll = <
  ContainerElement extends HTMLElement,
  ScrollElement extends HTMLElement
>() => {
  const containerRef = useRef<ContainerElement>(null)
  const scrollContainerRef = useRef<ScrollElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      handlePrioritizedWheelScroll(event, scrollContainerRef.current)
    }

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  return { containerRef, scrollContainerRef }
}
