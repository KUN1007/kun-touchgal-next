import sharp from 'sharp'

import { uploadImageToS3 } from '~/lib/s3'
import { checkBufferSize } from '~/app/api/utils/checkBufferSize'
import { withEncodeSlotOrBusy } from '~/server/image/encodeLimit'
import { ensureWithinPixelLimit } from '~/server/image/pixelGuard'

export const uploadPatchBanner = async (
  image: ArrayBuffer,
  id: number,
  originalImage?: ArrayBuffer
) => {
  if (image.byteLength === 0) {
    return '上传文件不能为空'
  }
  if (originalImage && originalImage.byteLength === 0) {
    return '上传文件不能为空'
  }

  const imagePixelError = await ensureWithinPixelLimit(image)
  if (imagePixelError) {
    return imagePixelError
  }
  if (originalImage) {
    const originalPixelError = await ensureWithinPixelLimit(originalImage)
    if (originalPixelError) {
      return originalPixelError
    }
  }

  const encodeFull = originalImage
    ? withEncodeSlotOrBusy(() =>
        sharp(originalImage)
          .resize(3840, null, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .avif({ quality: 60 })
          .toBuffer()
      )
    : undefined

  const [main, fullBanner] = await Promise.all([
    withEncodeSlotOrBusy(async () => {
      const banner = await sharp(image)
        .resize(1920, 1080, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .avif({ quality: 60 })
        .toBuffer()
      const miniBanner = await sharp(image)
        .resize(460, 259, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .avif({ quality: 60 })
        .toBuffer()
      return { banner, miniBanner }
    }),
    encodeFull
  ])

  if (typeof main === 'string') {
    return main
  }
  if (typeof fullBanner === 'string') {
    return fullBanner
  }
  const { banner, miniBanner } = main

  if (!checkBufferSize(banner, 5)) {
    return '图片体积过大'
  }
  if (!checkBufferSize(miniBanner, 1.007)) {
    return '图片体积过大'
  }
  if (fullBanner && !checkBufferSize(fullBanner, 10)) {
    return '图片体积过大'
  }

  const bucketName = `patch/${id}/banner`

  const uploadTasks = [
    uploadImageToS3(`${bucketName}/banner.avif`, banner),
    uploadImageToS3(`${bucketName}/banner-mini.avif`, miniBanner)
  ]

  if (fullBanner) {
    uploadTasks.push(
      uploadImageToS3(`${bucketName}/banner-full.avif`, fullBanner)
    )
  }

  await Promise.all(uploadTasks)
}
