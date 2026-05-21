import { centerCrop, makeAspectCrop } from 'react-image-crop'

export const centerAspectCrop = (
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) => {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

export const createCroppedImage = async (
  image: HTMLImageElement,
  crop: any,
  scale = 1,
  rotate = 0
) => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('没有图片输入')
  }

  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  canvas.width = Math.floor(crop.width * scaleX)
  canvas.height = Math.floor(crop.height * scaleY)

  ctx.imageSmoothingQuality = 'high'

  const cropX = crop.x * scaleX
  const cropY = crop.y * scaleY

  const rotateRads = (rotate * Math.PI) / 180
  const centerX = image.naturalWidth / 2
  const centerY = image.naturalHeight / 2

  ctx.save()
  ctx.translate(-cropX, -cropY)
  ctx.translate(centerX, centerY)
  ctx.rotate(rotateRads)
  ctx.scale(scale, scale)
  ctx.translate(-centerX, -centerY)
  ctx.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight
  )
  ctx.restore()

  return canvas.toDataURL('image/webp')
}

export const mosaicImg = (
  imageData: ImageData,
  width: number,
  height: number,
  mosaicSize: number
) => {
  const data = imageData.data

  for (let i = 0; i < height; i += mosaicSize) {
    for (let j = 0; j < width; j += mosaicSize) {
      let totalR = 0
      let totalG = 0
      let totalB = 0
      let totalA = 0
      const pixelIndices: number[] = []

      for (let y = i; y < i + mosaicSize && y < height; y++) {
        for (let x = j; x < j + mosaicSize && x < width; x++) {
          const pixelIndex = (y * width + x) * 4
          pixelIndices.push(pixelIndex)
          totalR += data[pixelIndex]
          totalG += data[pixelIndex + 1]
          totalB += data[pixelIndex + 2]
          totalA += data[pixelIndex + 3]
        }
      }

      const count = pixelIndices.length
      const avgR = totalR / count
      const avgG = totalG / count
      const avgB = totalB / count
      const avgA = totalA / count

      for (const pixelIndex of pixelIndices) {
        const fadeAmount = 1.2

        data[pixelIndex] = avgR * fadeAmount
        data[pixelIndex + 1] = avgG * fadeAmount
        data[pixelIndex + 2] = avgB * fadeAmount
        data[pixelIndex + 3] = avgA
      }
    }
  }

  return imageData
}
