import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { galgameSchema } from '~/validations/galgame'
import { getPatchByTagSchema } from '~/validations/tag'
import { getPatchByCompanySchema } from '~/validations/company'
import { MAX_GALGAME_FILTER_VALUES } from '~/utils/galgameFilter'

const makeYearString = (length: number) =>
  JSON.stringify(Array.from({ length }, (_, i) => String(1900 + i)))

// 65 个 4 位年份约 455 字符, 未触及 max(1007), 走的是 refine 而非长度上限
const overLimitString = makeYearString(MAX_GALGAME_FILTER_VALUES + 1)

const baseInput = {
  sortField: 'resource_update_time',
  sortOrder: 'desc',
  page: 1,
  limit: 24
}

const firstMessage = (result: z.ZodSafeParseResult<unknown>) =>
  result.success ? '' : result.error.issues[0].message

describe('galgameSchema 年份 / 月份元素数上限', () => {
  it('满额上限通过校验', () => {
    const result = galgameSchema.safeParse({
      ...baseInput,
      yearString: makeYearString(MAX_GALGAME_FILTER_VALUES)
    })
    expect(result.success).toBe(true)
  })

  it('年份超上限时硬拒且文案对齐 /api/search', () => {
    const result = galgameSchema.safeParse({
      ...baseInput,
      yearString: overLimitString
    })
    expect(result.success).toBe(false)
    expect(firstMessage(result)).toBe('您最多选择 64 组年份')
  })

  it('月份超上限时硬拒且文案正确', () => {
    const result = galgameSchema.safeParse({
      ...baseInput,
      monthString: overLimitString
    })
    expect(result.success).toBe(false)
    expect(firstMessage(result)).toBe('您最多选择 64 组月份')
  })

  it('畸形 JSON 仍放行, 由 parseGalgameFilterArray 回落容错', () => {
    const result = galgameSchema.safeParse({
      ...baseInput,
      yearString: '[broken'
    })
    expect(result.success).toBe(true)
  })
})

// tag / company 列表 schema 经 pick 继承字段级 refine, 防 pick 结构改动丢失硬拒
describe('getPatchByTagSchema / getPatchByCompanySchema 继承越界硬拒', () => {
  it('tag 端点年份超上限时硬拒', () => {
    const result = getPatchByTagSchema.safeParse({
      ...baseInput,
      tagId: 1,
      yearString: overLimitString
    })
    expect(result.success).toBe(false)
    expect(firstMessage(result)).toBe('您最多选择 64 组年份')
  })

  it('company 端点年份超上限时硬拒', () => {
    const result = getPatchByCompanySchema.safeParse({
      ...baseInput,
      companyId: 1,
      yearString: overLimitString
    })
    expect(result.success).toBe(false)
    expect(firstMessage(result)).toBe('您最多选择 64 组年份')
  })
})
