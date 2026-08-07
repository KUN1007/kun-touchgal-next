import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GALGAME_FILTER_SELECTION,
  MAX_GALGAME_FILTER_VALUES,
  MAX_MIN_RATING_COUNT_PARAM,
  MAX_PAGE_PARAM,
  kunShouldResetOverflowPage,
  parseGalgameFilterArray,
  parseNonNegativeIntParam,
  parsePositiveIntParam
} from '~/utils/galgameFilter'
import { buildGalgameDateFilter } from '~/app/api/utils/galgameQuery'

// CJK 单字保证每个元素在 JSON 里恰好 3 字符且不触发转义 (ASCII 段含 " 与 \),
// 251 个元素才能恰好压在 max(1007) 之内
const makeValues = (length: number) =>
  Array.from({ length }, (_, i) => String.fromCharCode(0x4e00 + i))

describe('parseGalgameFilterArray', () => {
  it('保留上限以内的选项', () => {
    const values = makeValues(MAX_GALGAME_FILTER_VALUES)
    expect(parseGalgameFilterArray(JSON.stringify(values))).toEqual(values)
  })

  it('元素数量超上限时回落到默认选项', () => {
    expect(
      parseGalgameFilterArray(
        JSON.stringify(makeValues(MAX_GALGAME_FILTER_VALUES + 1))
      )
    ).toEqual(DEFAULT_GALGAME_FILTER_SELECTION)
  })
})

describe('buildGalgameDateFilter', () => {
  const countConditions = (payload: string) => {
    const values = parseGalgameFilterArray(payload)
    const where = buildGalgameDateFilter(values, values) as { OR?: unknown[] }
    return where.OR?.length ?? 0
  }

  it('满额选项的年月笛卡尔积以上限的平方封顶', () => {
    expect(
      countConditions(JSON.stringify(makeValues(MAX_GALGAME_FILTER_VALUES)))
    ).toBe(MAX_GALGAME_FILTER_VALUES ** 2)
  })

  it('超上限载荷回落为默认选项, 不再展开条件', () => {
    // 251 个元素恰好压在 yearString/monthString 的 max(1007) 之内,
    // 未设上限时会展开出 63001 个 LIKE 谓词
    expect(JSON.stringify(makeValues(251)).length).toBeLessThanOrEqual(1007)
    expect(countConditions(JSON.stringify(makeValues(251)))).toBe(0)
  })
})

describe('parsePositiveIntParam', () => {
  it('合法页码取整放行', () => {
    expect(parsePositiveIntParam('3', 1)).toBe(3)
    expect(parsePositiveIntParam('2.9', 1)).toBe(2)
    expect(parsePositiveIntParam(String(MAX_PAGE_PARAM), 1)).toBe(
      MAX_PAGE_PARAM
    )
  })

  it('NaN / 空值 / 0 / 负数回落', () => {
    expect(parsePositiveIntParam('abc', 1)).toBe(1)
    expect(parsePositiveIntParam(undefined, 1)).toBe(1)
    expect(parsePositiveIntParam('0', 1)).toBe(1)
    expect(parsePositiveIntParam('-5', 1)).toBe(1)
  })

  it('超 schema 上界回落第 1 页而非透传硬拒', () => {
    expect(parsePositiveIntParam(String(MAX_PAGE_PARAM + 1), 1)).toBe(1)
    expect(parsePositiveIntParam('1e30', 1)).toBe(1)
    expect(parsePositiveIntParam('Infinity', 1)).toBe(1)
  })
})

describe('parseNonNegativeIntParam', () => {
  it('合法值取整放行, 0 是合法下界', () => {
    expect(parseNonNegativeIntParam('0', 10)).toBe(0)
    expect(parseNonNegativeIntParam('10.5', 0)).toBe(10)
    expect(
      parseNonNegativeIntParam(String(MAX_MIN_RATING_COUNT_PARAM), 0)
    ).toBe(MAX_MIN_RATING_COUNT_PARAM)
  })

  it('NaN / 负数 / 超 schema 上界回落', () => {
    expect(parseNonNegativeIntParam('abc', 10)).toBe(10)
    expect(parseNonNegativeIntParam('-1', 10)).toBe(10)
    expect(
      parseNonNegativeIntParam(String(MAX_MIN_RATING_COUNT_PARAM + 1), 0)
    ).toBe(0)
  })
})

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
