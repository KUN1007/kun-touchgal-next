import { describe, expect, it } from 'vitest'
import { patchCreateSchema, patchUpdateSchema } from '~/validations/edit'

// patch.bangumi_id / steam_id 是 int4 列。仅 max(10) 会放行 2147483648 ~ 9999999999，
// 这些值进入 Prisma 后抛 P2020 而非业务错误字符串，冒泡成 500
describe('外部 ID 的 int4 范围校验', () => {
  const cases = [
    { schema: patchCreateSchema, schemaName: 'create', field: 'bangumiId' },
    { schema: patchCreateSchema, schemaName: 'create', field: 'steamId' },
    { schema: patchUpdateSchema, schemaName: 'update', field: 'bangumiId' },
    { schema: patchUpdateSchema, schemaName: 'update', field: 'steamId' }
  ] as const

  cases.forEach(({ schema, schemaName, field }) => {
    const parseField = (value: string) => schema.shape[field].safeParse(value)

    it(`${schemaName}.${field} 拒绝超出 int4 的值`, () => {
      expect(parseField('9999999999').success).toBe(false)
      expect(parseField('2147483648').success).toBe(false)
    })

    it(`${schemaName}.${field} 接受 int4 边界值与常见真实 ID`, () => {
      expect(parseField('2147483647').success).toBe(true)
      expect(parseField('427846').success).toBe(true)
    })

    it(`${schemaName}.${field} 保持留空可选`, () => {
      expect(parseField('').success).toBe(true)
    })

    it(`${schemaName}.${field} 仍拒绝非纯数字`, () => {
      expect(parseField('abc').success).toBe(false)
    })
  })
})

// patch_tag.name 是 VarChar(107) 而 patch_alias.name 是 VarChar(1007)。标签上限
// 若放行 108+ 字符, 会在 patch 主事务提交后的 batchTag 才抛 22001 冒泡成 500
describe('update 标签与别名的长度上限', () => {
  it('tag 拒绝超过 107 字符的元素', () => {
    expect(
      patchUpdateSchema.shape.tag.safeParse(['x'.repeat(108)]).success
    ).toBe(false)
  })

  it('tag 接受 107 字符边界值', () => {
    expect(
      patchUpdateSchema.shape.tag.safeParse(['x'.repeat(107)]).success
    ).toBe(true)
  })

  it('alias 保持 500 上限不随标签一并收紧', () => {
    expect(
      patchUpdateSchema.shape.alias.safeParse(['x'.repeat(500)]).success
    ).toBe(true)
    expect(
      patchUpdateSchema.shape.alias.safeParse(['x'.repeat(501)]).success
    ).toBe(false)
  })
})
