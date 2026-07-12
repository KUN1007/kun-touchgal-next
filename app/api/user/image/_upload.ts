import sharp from 'sharp'

import { uploadImageToS3 } from '~/lib/s3'
import { checkBufferSize } from '~/app/api/utils/checkBufferSize'
import { withEncodeSlot } from '~/server/image/encodeLimit'

export const uploadIntroductionImage = async (
  name: string,
  image: ArrayBuffer,
  uid: number
) => {
  if (image.byteLength === 0) {
    return '上传文件不能为空'
  }

  const minImage = await withEncodeSlot(() =>
    sharp(image)
      .resize(1920, 1080, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .avif({ quality: 30 })
      .toBuffer()
  )

  if (!checkBufferSize(minImage, 1.007)) {
    return '图片体积过大'
  }

  const s3Key = `user/image/${uid}/${name}.avif`

  await uploadImageToS3(s3Key, minImage)
}
