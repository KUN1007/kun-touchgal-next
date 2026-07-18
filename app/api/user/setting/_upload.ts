import sharp from 'sharp'

import { copyObject, uploadImageToS3 } from '~/lib/s3'
import { checkBufferSize } from '~/app/api/utils/checkBufferSize'
import { withEncodeSlotOrBusy } from '~/server/image/encodeLimit'
import { ensureWithinPixelLimit } from '~/server/image/pixelGuard'
import { MODERATION_S3_TIMEOUT_MS } from '~/constants/moderation'

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

// 审核留档 key: 任务创建时把送审对象复制到此处永久保存, 使审核记录在 pending 暂存
// 对象被裁决清理、或正式 key 被后续上传覆盖后仍可回看; 刻意避开 pending/ 前缀,
// 不受暂存对象的 S3 lifecycle 过期影响. 留档站内无任何清理路径、永久累积——这是
// 已知的存储成本取舍 (小 avif 对象、上传受 50 张/日配额约束), 勿给此前缀配过期规则
export const getUserAvatarModerationArchiveKey = (uid: number, nonce: string) =>
  `user/avatar/user_${uid}/moderation/${nonce}.avif`

// 审核留档: 把送审对象复制到每次上传唯一的永久 key. 裁决后 pending 暂存对象会被
// apply.ts 清理、正式 key 会被后续上传覆盖, 留档使管理队列的审核记录始终可回看;
// 复制失败不阻断头像上传主流程 (返回 undefined, payload 省略字段), 仅该条记录
// 退化为裁决后无法显示
export const archiveAvatarForModeration = async (
  srcKey: string,
  uid: number,
  nonce: string
) => {
  const archiveKey = getUserAvatarModerationArchiveKey(uid, nonce)
  try {
    await copyObject(
      srcKey,
      archiveKey,
      AbortSignal.timeout(MODERATION_S3_TIMEOUT_MS)
    )
    return `${process.env.KUN_VISUAL_NOVEL_IMAGE_BED_URL}/${archiveKey}`
  } catch (error) {
    console.error('Failed to archive moderation avatar:', error)
    return undefined
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
