import { describe, expect, it } from 'vitest'
import { filterBlacklistPatterns } from '../prefilter'

describe('filterBlacklistPatterns', () => {
  const entries = [
    { pattern: 'all-types', content_types: [] },
    { pattern: 'comment-only', content_types: ['comment'] },
    { pattern: 'rating-bio', content_types: ['rating', 'bio'] }
  ]

  it('空 content_types 对全部类型生效', () => {
    expect(filterBlacklistPatterns(entries, 'resource')).toEqual(['all-types'])
  })

  it('只返回包含该类型的条目', () => {
    expect(filterBlacklistPatterns(entries, 'comment')).toEqual([
      'all-types',
      'comment-only'
    ])
    expect(filterBlacklistPatterns(entries, 'bio')).toEqual([
      'all-types',
      'rating-bio'
    ])
  })

  it('空条目列表返回空数组', () => {
    expect(filterBlacklistPatterns([], 'comment')).toEqual([])
  })
})
