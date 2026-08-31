import { describe, expect, it } from 'vitest'
import { truncateLogContent } from '~/app/api/admin/_log'
import { ADMIN_LOG_CONTENT_LIMIT } from '~/constants/admin'

describe('truncateLogContent', () => {
  it('returns content within the column limit unchanged', () => {
    const content = 'a'.repeat(ADMIN_LOG_CONTENT_LIMIT)
    expect(truncateLogContent(content)).toBe(content)
  })

  it('truncates oversized content to fit the admin_log column', () => {
    const content = 'a'.repeat(ADMIN_LOG_CONTENT_LIMIT + 1)
    const truncated = truncateLogContent(content)
    expect(truncated.length).toBeLessThanOrEqual(ADMIN_LOG_CONTENT_LIMIT)
    expect(truncated.endsWith('...(truncated)')).toBe(true)
  })
})
