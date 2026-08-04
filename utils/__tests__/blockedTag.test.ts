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
    expect(parsed.at(-1)).toBe(MAX_BLOCKED_TAG_IDS)
  })

  // 现网最长的存量列表是 328 项, 上限不得让存量用户的屏蔽失效
  it('keeps the longest real-world list intact', () => {
    expect(parseBlockedTagIds(JSON.stringify(range(328)))).toHaveLength(328)
  })

  // 截断发生在过滤之后, 否则无效项可以挤掉配额内的有效 id
  it('caps after filtering out invalid entries', () => {
    const ids = [...range(MAX_BLOCKED_TAG_IDS).map((id) => -id), ...range(10)]

    expect(parseBlockedTagIds(JSON.stringify(ids))).toEqual(range(10))
  })
})
