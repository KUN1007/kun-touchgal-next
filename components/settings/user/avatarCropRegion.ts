import { convertToPixelCrop } from 'react-image-crop'
import type { PercentCrop } from 'react-image-crop'

// 服务端 (_upload.ts) 只保留 256px, 512 是 2 倍余量; 上限同时挡住 48MP 原图裁出
// 6000² 级 canvas (iOS Safari 超面积上限时 toDataURL 出空图) 与数 MB 的无谓上传
export const AVATAR_OUTPUT_MAX_EDGE = 512

// 把 ReactCrop 的受控百分比 crop 换算成原图像素坐标与输出尺寸; 参数收窄为 PercentCrop,
// 误把 onChange 第一参数 (PixelCrop) 存进 state 会在 tsc 处报错, 不再靠运行时分辨单位。
// 纯函数不碰 DOM, 使换算能在无 jsdom 的 vitest 下覆盖
export const resolveAvatarCropRegion = (
  crop: PercentCrop,
  displayWidth: number,
  displayHeight: number,
  naturalWidth: number,
  naturalHeight: number
) => {
  const pixelCrop = convertToPixelCrop(crop, displayWidth, displayHeight)
  const scaleX = naturalWidth / displayWidth
  const scaleY = naturalHeight / displayHeight
  const sx = pixelCrop.x * scaleX
  const sy = pixelCrop.y * scaleY
  const sw = pixelCrop.width * scaleX
  const sh = pixelCrop.height * scaleY
  const ratio = Math.min(1, AVATAR_OUTPUT_MAX_EDGE / Math.max(sw, sh))

  return {
    sx,
    sy,
    sw,
    sh,
    width: Math.round(sw * ratio),
    height: Math.round(sh * ratio)
  }
}
