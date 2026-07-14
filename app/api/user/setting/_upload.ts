import sharp from 'sharp'

import { uploadImageToS3 } from '~/lib/s3'
import { checkBufferSize } from '~/app/api/utils/checkBufferSize'
import { withEncodeSlotOrBusy } from '~/server/image/encodeLimit'
import { ensureWithinPixelLimit } from '~/server/image/pixelGuard'

// 头像正式 S3 key 的唯一定义处 (发布位置, 每用户固定); 审核暂存 key 见
// getUserAvatarPendingKeys —— 刻意分离, 不让暂存对象再共用一个固定 key
export const getUserAvatarKeys = (uid: number) => {
  const dir = `user/avatar/user_${uid}`
  return {
    avatarKey: `${dir}/avatar.avif`,
    avatarMiniKey: `${dir}/avatar-mini.avif`
  }
}

// 每次上传生成唯一、不可变的暂存 key: worker 送审读取、AI 裁决、apply 复制全程绑定
// 同一对象, 并发上传各写各的 key, 杜绝"送审字节 ≠ 落地字节"的审核绕过竞态. pending/
// 前缀便于对暂存对象单独配 S3 lifecycle 过期, 兜底被 supersede 而 apply 不会清理的孤儿
export const getUserAvatarPendingKeys = (uid: number, nonce: string) => {
  const dir = `user/avatar/user_${uid}/pending`
  return {
    pendingKey: `${dir}/${nonce}.avif`,
    pendingMiniKey: `${dir}/${nonce}-mini.avif`
  }
}

export const uploadUserAvatar = async (
  image: ArrayBuffer,
  uid: number,
  // 审核开启时先上传到唯一暂存 key (getUserAvatarPendingKeys), 通过后由 apply.ts
  // 复制到正式 key; 不传则直接写正式 key
  pendingKeys?: { pendingKey: string; pendingMiniKey: string }
) => {
  if (image.byteLength === 0) {
    return '上传文件不能为空'
  }

  const pixelError = await ensureWithinPixelLimit(image)
  if (pixelError) {
    return pixelError
  }

  const encoded = await withEncodeSlotOrBusy(async () => {
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

  if (typeof encoded === 'string') {
    return encoded
  }
  const { avatar, miniAvatar } = encoded

  if (!checkBufferSize(avatar, 1.007)) {
    return '图片体积过大'
  }

  if (pendingKeys) {
    await uploadImageToS3(pendingKeys.pendingKey, avatar)
    await uploadImageToS3(pendingKeys.pendingMiniKey, miniAvatar)
  } else {
    const keys = getUserAvatarKeys(uid)
    await uploadImageToS3(keys.avatarKey, avatar)
    await uploadImageToS3(keys.avatarMiniKey, miniAvatar)
  }
}
