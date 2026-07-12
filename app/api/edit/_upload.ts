import sharp from 'sharp'

import { uploadImageToS3 } from '~/lib/s3'
import { checkBufferSize } from '~/app/api/utils/checkBufferSize'
import { withEncodeSlot } from '~/server/image/encodeLimit'
import { MAX_IMAGE_PIXELS } from '~/validations/file'

const ensureWithinPixelLimit = async (
  buffer: ArrayBuffer
): Promise<string | undefined> => {
  const { width, height } = await sharp(buffer).metadata()
  if (!width || !height) {
    return '无法解析图片尺寸'
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    return '图片尺寸过大'
  }
}

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
    ? withEncodeSlot(() =>
        sharp(originalImage)
          .resize(3840, null, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .avif({ quality: 60 })
          .toBuffer()
      )
    : undefined

  const [{ banner, miniBanner }, fullBanner] = await Promise.all([
    withEncodeSlot(async () => {
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
