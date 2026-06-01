'use client'

import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Download from 'yet-another-react-lightbox/plugins/download'
import 'yet-another-react-lightbox/styles.css'

interface Slide {
  src: string
  width?: number
  height?: number
}

interface Props {
  open: boolean
  slides: Slide[]
  index?: number
  onClose: () => void
}

export const KunImageLightbox = ({
  open,
  slides,
  index = 0,
  onClose
}: Props) => {
  return (
    <Lightbox
      index={index}
      slides={slides}
      open={open}
      close={onClose}
      plugins={[Zoom, Download]}
      animation={{ fade: 300 }}
      carousel={{
        finite: true,
        preload: 2,
        imageProps: {
          style: {
            maxWidth: 'none',
            maxHeight: 'none',
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }
        }
      }}
      zoom={{
        maxZoomPixelRatio: 3,
        scrollToZoom: true
      }}
      controller={{
        closeOnBackdropClick: true
      }}
      styles={{ container: { backgroundColor: 'rgba(0, 0, 0, .7)' } }}
    />
  )
}
