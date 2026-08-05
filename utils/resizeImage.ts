import toast from 'react-hot-toast'
import { dataURItoBlob } from '~/utils/dataURItoBlob'

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export const checkImageValid = (file: File) => {
  if (allowedTypes.includes(file.type)) {
    return true
  } else {
    toast.error('我们仅支持 jpg, png, webp, avif 图片')
    return false
  }
}

interface CompressDataURLOptions {
  maxDimension?: number
  quality?: number
  maxSizeBytes?: number
}

export const compressDataURLToWebp = (
  dataUrl: string,
  options: CompressDataURLOptions = {}
): Promise<Blob> => {
  const { maxDimension = 3840, quality = 0.85, maxSizeBytes } = options

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      let width = image.naturalWidth
      let height = image.naturalHeight

      if (width > maxDimension || height > maxDimension) {
        const aspectRatio = width / height
        if (aspectRatio > 1) {
          width = maxDimension
          height = Math.round(maxDimension / aspectRatio)
        } else {
          height = maxDimension
          width = Math.round(maxDimension * aspectRatio)
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建 canvas 上下文'))
        return
      }
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(image, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('压缩图片为 WebP 失败'))
            return
          }
          if (maxSizeBytes && blob.size > maxSizeBytes) {
            const limitMb = (maxSizeBytes / 1024 / 1024).toFixed(1)
            reject(
              new Error(`压缩后原图体积仍超过 ${limitMb} MB, 请选择更小的图片`)
            )
            return
          }
          resolve(blob)
        },
        'image/webp',
        quality
      )
    }
    image.onerror = () => reject(new Error('图片加载失败'))
    image.src = dataUrl
  })
}

export const resizeImage = (
  file: File,
  width: number,
  height: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      let newWidth = image.width
      let newHeight = image.height

      if (image.width > width || image.height > height) {
        const aspectRatio = image.width / image.height
        if (aspectRatio > 1) {
          newWidth = width
          newHeight = newWidth / aspectRatio
        } else {
          newHeight = height
          newWidth = newHeight * aspectRatio
        }
      }

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = newWidth
      canvas.height = newHeight

      ctx?.drawImage(image, 0, 0, newWidth, newHeight)
      URL.revokeObjectURL(objectUrl)
      const resizedBlob = dataURItoBlob(canvas.toDataURL('image/webp', 0.77))
      const file = new File([resizedBlob], 'image.webp', { type: 'image/webp' })

      if (file.size > 1.007 * 1024 * 1024) {
        toast.error('压缩后图片体积过大, 超过 1007kb')
        reject(new Error('Image is too large.'))
      } else {
        resolve(file)
      }
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      toast.error('图片加载失败, 图片可能已损坏或格式不受支持')
      reject(new Error('图片加载失败'))
    }
    image.src = objectUrl
  })
}
