'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useMounted } from '~/hooks/useMounted'

const shouldSkipLightbox = (img: HTMLImageElement) => {
  return Boolean(img.closest('[data-no-lightbox], .yarl__portal'))
}

const KunImageLightbox = dynamic(
  () =>
    import('~/components/kun/image-viewer/ImageLightbox').then(
      (mod) => mod.KunImageLightbox
    ),
  { ssr: false }
)

export const KunAutoImageViewer = () => {
  const [openImage, setOpenImage] = useState<string | null>(null)
  const [images, setImages] = useState<
    { src: string; width: number; height: number }[]
  >([])
  const isMounted = useMounted()

  useEffect(() => {
    if (!isMounted) {
      return
    }

    const processedImages = new Set<HTMLImageElement>()

    const handleImageClick = (event: Event) => {
      const currentTarget = event.currentTarget
      if (!(currentTarget instanceof HTMLImageElement)) {
        return
      }

      setOpenImage(currentTarget.currentSrc || currentTarget.src)
    }

    const checkImageDimensions = (img: HTMLImageElement) => {
      if (shouldSkipLightbox(img)) {
        return
      }

      const rect = img.getBoundingClientRect()
      const renderedWidth = rect.width || img.width
      const renderedHeight = rect.height || img.height
      const width = img.naturalWidth || renderedWidth
      const height = img.naturalHeight || renderedHeight
      const src = img.currentSrc || img.src

      if (renderedWidth >= 200 && renderedHeight >= 200) {
        setImages((prev) => {
          const exists = prev.some((image) => image.src === src)
          if (!exists) {
            return [...prev, { src, width, height }]
          }
          return prev
        })

        if (!processedImages.has(img)) {
          processedImages.add(img)
          img.style.cursor = 'pointer'
          img.addEventListener('click', handleImageClick)
        }
      }
    }

    const processImage = (img: HTMLImageElement) => {
      if (img.complete) {
        checkImageDimensions(img)
        return
      }

      img.addEventListener('load', () => checkImageDimensions(img), {
        once: true
      })
    }

    const collectImages = (node: Node) => {
      if (node instanceof HTMLImageElement) {
        return [node]
      }

      if (node instanceof Element) {
        return Array.from(node.querySelectorAll('img'))
      }

      return []
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          collectImages(node).forEach(processImage)
        })
      })
    })

    document.querySelectorAll('img').forEach((img) => {
      processImage(img)
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    return () => {
      observer.disconnect()
      processedImages.forEach((img) => {
        img.removeEventListener('click', handleImageClick)
      })
    }
  }, [isMounted])

  const currentImageIndex = openImage
    ? images.findIndex((img) => img.src === openImage)
    : -1
  const visibleImages =
    openImage && currentImageIndex < 0 ? [{ src: openImage }] : images

  if (!openImage) {
    return null
  }

  return (
    <KunImageLightbox
      index={Math.max(currentImageIndex, 0)}
      slides={visibleImages}
      open={true}
      onClose={() => setOpenImage(null)}
    />
  )
}
