import { describe, expect, it } from 'vitest'
import { kunShouldResetOverflowPage } from '~/utils/galgameFilter'

describe('kunShouldResetOverflowPage', () => {
  it('筛选收紧后页码越界 (有结果但当前页为空) 时重置', () => {
    expect(kunShouldResetOverflowPage(3, 0, 5)).toBe(true)
    expect(kunShouldResetOverflowPage(3, 0, 2)).toBe(true)
    expect(kunShouldResetOverflowPage(50, 0, 5)).toBe(true)
  })

  it('第 1 页不重置, 防止 total 与列表不一致时循环', () => {
    expect(kunShouldResetOverflowPage(3, 0, 1)).toBe(false)
  })

  it('当前页有数据时不重置', () => {
    expect(kunShouldResetOverflowPage(50, 24, 3)).toBe(false)
    expect(kunShouldResetOverflowPage(50, 2, 3)).toBe(false)
  })

  it('total 为 0 时不重置, 交给空态渲染', () => {
    expect(kunShouldResetOverflowPage(0, 0, 5)).toBe(false)
    expect(kunShouldResetOverflowPage(0, 0, 1)).toBe(false)
  })
})
