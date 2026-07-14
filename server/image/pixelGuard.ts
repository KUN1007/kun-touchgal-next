import sharp from 'sharp'

import { MAX_IMAGE_PIXELS } from '~/validations/file'

// 编码前的廉价护栏: metadata() 只读文件头、不解码像素, 用它在真正 decode 之前拦掉
// 高压缩比"像素炸弹"(声明尺寸巨大、压缩后体积却很小的图), 避免 ≤10MB 的上传解码成
// 近 GB 级位图打爆内存与编码线程. 阈值 MAX_IMAGE_PIXELS = 50MP, 远大于正常原图.
export const ensureWithinPixelLimit = async (
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
