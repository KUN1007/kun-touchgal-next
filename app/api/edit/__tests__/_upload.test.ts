import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

const { uploadImageToS3Mock } = vi.hoisted(() => ({
  uploadImageToS3Mock: vi.fn()
}))

vi.mock('~/lib/s3', () => ({
  uploadImageToS3: uploadImageToS3Mock
}))

import { uploadPatchBanner } from '../_upload'

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

describe('uploadPatchBanner', () => {
  beforeEach(() => {
    uploadImageToS3Mock.mockReset()
    uploadImageToS3Mock.mockResolvedValue(undefined)
  })

  it('原图像素数超过上限时前置拒绝, 不触发编码与上传', async () => {
    const bomb = await createPng(8000, 7000) // 56M > 50M 上限
    const res = await uploadPatchBanner(bomb, 1)
    expect(res).toBe('图片尺寸过大')
    expect(uploadImageToS3Mock).not.toHaveBeenCalled()
  }, 30000)

  it('空文件返回错误', async () => {
    const res = await uploadPatchBanner(new ArrayBuffer(0), 1)
    expect(res).toBe('上传文件不能为空')
    expect(uploadImageToS3Mock).not.toHaveBeenCalled()
  })

  it('正常图片上传三个变体, full 变体被限制在 3840 宽以内', async () => {
    const image = await createPng(3900, 100)
    const res = await uploadPatchBanner(image, 42, image)
    expect(res).toBeUndefined()
    expect(uploadImageToS3Mock).toHaveBeenCalledTimes(3)

    const fullCall = uploadImageToS3Mock.mock.calls.find(([key]) =>
      String(key).endsWith('banner-full.avif')
    )
    expect(fullCall).toBeDefined()
    const fullMeta = await sharp(fullCall?.[1] as Buffer).metadata()
    expect(fullMeta.width).toBeLessThanOrEqual(3840)
  }, 30000)
})
