import { describe, expect, it } from 'vitest'
import { MAX_BLOCKED_TAG_IDS, parseBlockedTagIds } from '~/utils/blockedTag'

const range = (length: number, from = 1) =>
  Array.from({ length }, (_, index) => index + from)

describe('parseBlockedTagIds', () => {
  it('caps the list at MAX_BLOCKED_TAG_IDS', () => {
    const parsed = parseBlockedTagIds(
      JSON.stringify(range(MAX_BLOCKED_TAG_IDS + 500))
    )

    expect(parsed).toHaveLength(MAX_BLOCKED_TAG_IDS)
    expect(parsed?.at(-1)).toBe(MAX_BLOCKED_TAG_IDS)
  })

  // 现网最长的存量列表是 328 项, 上限不得让存量用户的屏蔽失效
  it('keeps the longest real-world list intact', () => {
    expect(parseBlockedTagIds(JSON.stringify(range(328)))).toHaveLength(328)
  })

  // tag_id 是 int4, 越界值会让 Prisma 抛 P2020 冒泡成 500
  it('drops ids beyond int4 range', () => {
    const ids = [1, 2147483647, 2147483648, 1e21]

    expect(parseBlockedTagIds(JSON.stringify(ids))).toEqual([1, 2147483647])
  })

  // 截断发生在过滤之后, 否则无效项可以挤掉配额内的有效 id
  it('caps after filtering out invalid entries', () => {
    const ids = [...range(MAX_BLOCKED_TAG_IDS).map((id) => -id), ...range(10)]

    expect(parseBlockedTagIds(JSON.stringify(ids))).toEqual(range(10))
  })

  // 坏缓存返回 null 让调用方回落 DB, 与 next/headers 丢弃畸形 cookie 的语义
  // 对齐; 曾返回 [] 使 API 路由把 DB 里的屏蔽列表短路成「不屏蔽」
  it('returns null for unparseable cache values', () => {
    expect(parseBlockedTagIds('%2')).toBeNull()
    expect(parseBlockedTagIds('100%')).toBeNull()
    expect(parseBlockedTagIds('')).toBeNull()
    expect(parseBlockedTagIds('{"kun":1}')).toBeNull()
  })

  // 空数组是「用户清空了屏蔽列表」的合法缓存, 不能与坏缓存混为一谈
  it('keeps the empty list as a legal cached value', () => {
    expect(parseBlockedTagIds('[]')).toEqual([])
  })
})
