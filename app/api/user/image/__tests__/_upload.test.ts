import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

const { uploadImageToS3Mock } = vi.hoisted(() => ({
  uploadImageToS3Mock: vi.fn()
}))

vi.mock('~/lib/s3', () => ({
  uploadImageToS3: uploadImageToS3Mock
}))

import { uploadIntroductionImage } from '../_upload'

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

describe('uploadIntroductionImage', () => {
  beforeEach(() => {
    uploadImageToS3Mock.mockReset()
    uploadImageToS3Mock.mockResolvedValue(undefined)
  })

  it('原图像素数超过上限时前置拒绝, 不触发编码与上传', async () => {
    const bomb = await createPng(8000, 7000) // 56M > 50M 上限
    const res = await uploadIntroductionImage('bomb', bomb, 1)
    expect(res).toBe('图片尺寸过大')
    expect(uploadImageToS3Mock).not.toHaveBeenCalled()
  }, 30000)

  it('空文件返回错误', async () => {
    const res = await uploadIntroductionImage('empty', new ArrayBuffer(0), 1)
    expect(res).toBe('上传文件不能为空')
    expect(uploadImageToS3Mock).not.toHaveBeenCalled()
  })

  it('正常图片编码并上传单个变体', async () => {
    const image = await createPng(1200, 800)
    const res = await uploadIntroductionImage('myfile', image, 42)
    expect(res).toBeUndefined()
    expect(uploadImageToS3Mock).toHaveBeenCalledTimes(1)
  }, 30000)
})
