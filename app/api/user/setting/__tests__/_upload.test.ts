import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

const { uploadImageToS3Mock } = vi.hoisted(() => ({
  uploadImageToS3Mock: vi.fn()
}))

vi.mock('~/lib/s3', () => ({
  uploadImageToS3: uploadImageToS3Mock
}))

import {
  getUserAvatarKeys,
  getUserAvatarPendingKeys,
  uploadUserAvatar
} from '~/app/api/user/setting/_upload'

const createPng = async (
  width: number,
  height: number
): Promise<ArrayBuffer> => {
  const buf = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 100, g: 150, b: 200 }
    }
  })
    .png()
    .toBuffer()
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  ) as ArrayBuffer
}

describe('getUserAvatarKeys', () => {
  it('每用户固定, 只暴露正式发布 key, 不再含可变共享的暂存 key', () => {
    const keys = getUserAvatarKeys(42)
    expect(keys).toEqual({
      avatarKey: 'user/avatar/user_42/avatar.avif',
      avatarMiniKey: 'user/avatar/user_42/avatar-mini.avif'
    })
    // 正式 key 稳定: 同 uid 多次调用一致 (发布位置固定)
    expect(getUserAvatarKeys(42)).toEqual(keys)
    // 暂存 key 已从此处移除, 改由 getUserAvatarPendingKeys 每次上传唯一生成
    expect(keys).not.toHaveProperty('pendingKey')
    expect(keys).not.toHaveProperty('pendingMiniKey')
  })
})

describe('getUserAvatarPendingKeys', () => {
  it('把 nonce 编入路径, 暂存对象落在独立 pending/ 前缀下', () => {
    expect(getUserAvatarPendingKeys(42, 'nonce-abc')).toEqual({
      pendingKey: 'user/avatar/user_42/pending/nonce-abc.avif',
      pendingMiniKey: 'user/avatar/user_42/pending/nonce-abc-mini.avif'
    })
  })

  it('不同 nonce 产生不同 pending key —— 并发上传各写各的对象, 无从互相覆盖', () => {
    const a = getUserAvatarPendingKeys(42, 'nonce-a')
    const b = getUserAvatarPendingKeys(42, 'nonce-b')
    expect(a.pendingKey).not.toBe(b.pendingKey)
    expect(a.pendingMiniKey).not.toBe(b.pendingMiniKey)
  })

  it('暂存 key 与正式 key 不相交 —— apply 的复制目标永不等于复制源', () => {
    const finalKeys = new Set(Object.values(getUserAvatarKeys(42)))
    const pendingKeys = getUserAvatarPendingKeys(42, 'nonce-x')
    for (const key of Object.values(pendingKeys)) {
      expect(finalKeys.has(key)).toBe(false)
    }
  })
})

describe('uploadUserAvatar', () => {
  beforeEach(() => {
    uploadImageToS3Mock.mockReset()
    uploadImageToS3Mock.mockResolvedValue(undefined)
  })

  it('原图像素数超过上限时前置拒绝, 不触发编码与上传', async () => {
    const bomb = await createPng(8000, 7000) // 56M > 50M 上限
    const res = await uploadUserAvatar(bomb, 1)
    expect(res).toBe('图片尺寸过大')
    expect(uploadImageToS3Mock).not.toHaveBeenCalled()
  }, 30000)

  it('空文件返回错误', async () => {
    const res = await uploadUserAvatar(new ArrayBuffer(0), 1)
    expect(res).toBe('上传文件不能为空')
    expect(uploadImageToS3Mock).not.toHaveBeenCalled()
  })

  it('正常图片编码并上传头像与 mini 两个变体', async () => {
    const image = await createPng(512, 512)
    const res = await uploadUserAvatar(image, 42)
    expect(res).toBeUndefined()
    expect(uploadImageToS3Mock).toHaveBeenCalledTimes(2)
  }, 30000)
})
