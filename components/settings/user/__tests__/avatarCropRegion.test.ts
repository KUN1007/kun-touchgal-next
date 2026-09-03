import { describe, expect, it } from 'vitest'
import {
  AVATAR_OUTPUT_MAX_EDGE,
  resolveAvatarCropRegion
} from '~/components/settings/user/avatarCropRegion'

describe('resolveAvatarCropRegion', () => {
  it('默认百分比选框先按显示尺寸换算, 再映射到原图像素', () => {
    // 修前把 % 当 px: canvas 50×50, 源区域 (50, 50, 100, 100)
    const region = resolveAvatarCropRegion(
      { unit: '%', x: 25, y: 25, width: 50, height: 50 },
      500,
      500,
      1000,
      1000
    )

    expect(region).toEqual({
      sx: 250,
      sy: 250,
      sw: 500,
      sh: 500,
      width: 500,
      height: 500
    })
  })

  it('横图上的默认框 (50% 宽 × 100% 高) 换算后仍是正方形原图区域', () => {
    // 800×400 显示上 centerAspectCrop(…, 1, 50) 产出的就是这个百分比框
    const region = resolveAvatarCropRegion(
      { unit: '%', x: 25, y: 0, width: 50, height: 100 },
      800,
      400,
      1000,
      500
    )

    expect(region).toEqual({
      sx: 250,
      sy: 0,
      sw: 500,
      sh: 500,
      width: 500,
      height: 500
    })
  })

  it('输出长边封顶 AVATAR_OUTPUT_MAX_EDGE, 源区域仍取原图全量像素', () => {
    const region = resolveAvatarCropRegion(
      { unit: '%', x: 0, y: 0, width: 100, height: 100 },
      400,
      400,
      8000,
      8000
    )

    expect(region.sw).toBe(8000)
    expect(region.sh).toBe(8000)
    expect(region.width).toBe(AVATAR_OUTPUT_MAX_EDGE)
    expect(region.height).toBe(AVATAR_OUTPUT_MAX_EDGE)
  })
})
