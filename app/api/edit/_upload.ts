import sharp from 'sharp'

import { uploadImageToS3 } from '~/lib/s3'
import { checkBufferSize } from '~/app/api/utils/checkBufferSize'
import { withEncodeSlot } from '~/server/image/encodeLimit'

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

  const { banner, miniBanner } = await withEncodeSlot(async () => {
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
  })

  if (!checkBufferSize(miniBanner, 1.007)) {
    return '图片体积过大'
  }

  const bucketName = `patch/${id}/banner`

  const uploadTasks = [
    uploadImageToS3(`${bucketName}/banner.avif`, banner),
    uploadImageToS3(`${bucketName}/banner-mini.avif`, miniBanner)
  ]

  if (originalImage) {
    uploadTasks.push(
      withEncodeSlot(() =>
        sharp(originalImage).avif({ quality: 60 }).toBuffer()
      ).then((fullBanner) =>
        uploadImageToS3(`${bucketName}/banner-full.avif`, fullBanner)
      )
    )
  }

  await Promise.all(uploadTasks)
}
