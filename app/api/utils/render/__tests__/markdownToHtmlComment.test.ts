import { afterEach, describe, expect, it, vi } from 'vitest'

const { getKvMock, setKvMock, delKvMock } = vi.hoisted(() => ({
  getKvMock: vi.fn(async () => null),
  setKvMock:
    vi.fn<(key: string, value: string, ttlSeconds?: number) => Promise<void>>(),
  delKvMock: vi.fn(async () => {})
}))

vi.mock('~/lib/redis', () => ({
  getKv: getKvMock,
  setKv: setKvMock,
  delKv: delKvMock
}))

import {
  COMMENT_HTML_VERSION,
  markdownToHtmlComment
} from '~/app/api/utils/render/markdownToHtmlComment'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('markdownToHtmlComment 缓存键版本化', () => {
  it('缓存键纳入 COMMENT_HTML_VERSION, 版本递增后不再复用旧策略 HTML', async () => {
    vi.stubEnv('REDIS_HOST', '127.0.0.1')
    vi.stubEnv('REDIS_PORT', '6379')

    await markdownToHtmlComment('hello')

    expect(setKvMock).toHaveBeenCalledOnce()
    const [cacheKey] = setKvMock.mock.calls[0]
    expect(cacheKey).toContain(`comment-v${COMMENT_HTML_VERSION}`)
  })
})
