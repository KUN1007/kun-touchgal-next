import { describe, expect, it } from 'vitest'
import { kunShouldBackfillDeletedRow } from '~/utils/pagination'

describe('kunShouldBackfillDeletedRow', () => {
  it('最后一页删行无需补齐 (没有记录可前移进本页)', () => {
    expect(kunShouldBackfillDeletedRow(30, 1, 30)).toBe(false)
    expect(kunShouldBackfillDeletedRow(29, 1, 30)).toBe(false)
    expect(kunShouldBackfillDeletedRow(60, 2, 30)).toBe(false)
    expect(kunShouldBackfillDeletedRow(0, 1, 30)).toBe(false)
  })

  it('存在下一页时须补齐', () => {
    expect(kunShouldBackfillDeletedRow(31, 1, 30)).toBe(true)
    expect(kunShouldBackfillDeletedRow(61, 2, 30)).toBe(true)
    expect(kunShouldBackfillDeletedRow(101, 2, 50)).toBe(true)
  })
})
