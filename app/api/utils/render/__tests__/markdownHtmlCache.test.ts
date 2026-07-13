import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderMarkdownHtmlWithCache } from '~/app/api/utils/render/markdownHtmlCache'
import { MARKDOWN_HTML_CACHE_MAX_MARKDOWN_BYTES } from '~/config/cache'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('renderMarkdownHtmlWithCache 输入侧字节上限', () => {
  it('超过字节上限时降级为纯文本且不触发同步渲染', async () => {
    // 每个「一」占 3 字节，字符数取上限值即约 3 倍字节，远超限
    const oversized = '一'.repeat(MARKDOWN_HTML_CACHE_MAX_MARKDOWN_BYTES)
    const render = vi.fn(async () => '<p>rendered-should-not-run</p>')

    const html = await renderMarkdownHtmlWithCache('comment', oversized, render)

    expect(render).not.toHaveBeenCalled()
    expect(html).toContain('已截断')
    expect(html).not.toContain('rendered-should-not-run')
  })

  it('未超上限时正常调用 render（缓存不可用则直接渲染）', async () => {
    vi.stubEnv('REDIS_HOST', '')
    vi.stubEnv('REDIS_PORT', '')
    const render = vi.fn(async () => '<p>rendered</p>')

    const html = await renderMarkdownHtmlWithCache(
      'comment',
      '正常内容',
      render
    )

    expect(render).toHaveBeenCalledOnce()
    expect(html).toBe('<p>rendered</p>')
  })
})
