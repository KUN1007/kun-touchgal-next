import sharp from 'sharp'

import { uploadImageToS3 } from '~/lib/s3'
import { checkBufferSize } from '~/app/api/utils/checkBufferSize'
import { withEncodeSlot } from '~/server/image/encodeLimit'

// 头像 S3 key 的唯一定义处, 上传 / 审核暂存 / 审核落地共用
export const getUserAvatarKeys = (uid: number) => {
  const dir = `user/avatar/user_${uid}`
  return {
    avatarKey: `${dir}/avatar.avif`,
    avatarMiniKey: `${dir}/avatar-mini.avif`,
    pendingKey: `${dir}/avatar-pending.avif`,
    pendingMiniKey: `${dir}/avatar-mini-pending.avif`
  }
}

export const uploadUserAvatar = async (
  image: ArrayBuffer,
  uid: number,
  // 审核开启时先上传到暂存 key, 通过后由 apply.ts 复制到正式 key
  pending = false
) => {
  if (image.byteLength === 0) {
    return '上传文件不能为空'
  }

  const { avatar, miniAvatar } = await withEncodeSlot(async () => {
    const avatar = await sharp(image)
      .resize(256, 256, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .avif({ quality: 60 })
      .toBuffer()
    const miniAvatar = await sharp(image)
      .resize(100, 100, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .avif({ quality: 50 })
      .toBuffer()
    return { avatar, miniAvatar }
  })

  if (!checkBufferSize(avatar, 1.007)) {
    return '图片体积过大'
  }

  const keys = getUserAvatarKeys(uid)

  if (pending) {
    await uploadImageToS3(keys.pendingKey, avatar)
    await uploadImageToS3(keys.pendingMiniKey, miniAvatar)
  } else {
    await uploadImageToS3(keys.avatarKey, avatar)
    await uploadImageToS3(keys.avatarMiniKey, miniAvatar)
  }
}
