import { createHash } from 'crypto'
import {
  MARKDOWN_HTML_CACHE_DURATION,
  MARKDOWN_HTML_CACHE_MAX_HTML_BYTES,
  MARKDOWN_HTML_CACHE_MAX_MARKDOWN_BYTES
} from '~/config/cache'

type MarkdownHtmlCacheVariant = 'standard' | 'extend' | 'comment'
type MarkdownHtmlRenderer = () => Promise<string>
type MarkdownHtmlCacheOptions = {
  enabled?: boolean
  ttlSeconds?: number
  maxMarkdownBytes?: number
  maxHtmlBytes?: number
}

const MARKDOWN_HTML_CACHE_KEY = 'markdown:html'
const MARKDOWN_HTML_CACHE_VERSION = 'v2'
const MARKDOWN_HTML_CACHE_TIMEOUT_MS = 200
const MARKDOWN_HTML_CACHE_RETRY_DELAY_MS = 30 * 1000
const MARKDOWN_HTML_RENDER_TIMEOUT_MS = 10 * 1000

let markdownHtmlCacheDisabledUntil = 0

const inFlightRenders = new Map<string, Promise<string>>()

const isRedisConfigured = () =>
  Boolean(process.env.REDIS_HOST && process.env.REDIS_PORT)

const isMarkdownHtmlCacheAvailable = () =>
  isRedisConfigured() && Date.now() >= markdownHtmlCacheDisabledUntil

const disableMarkdownHtmlCache = () => {
  markdownHtmlCacheDisabledUntil =
    Date.now() + MARKDOWN_HTML_CACHE_RETRY_DELAY_MS
}

const isWithinByteLimit = (value: string, maxBytes: number) =>
  Buffer.byteLength(value, 'utf8') <= maxBytes

const getMarkdownHtmlCacheKey = (
  variant: MarkdownHtmlCacheVariant,
  markdown: string
) => {
  const hash = createHash('sha256').update(markdown).digest('hex')
  return `${MARKDOWN_HTML_CACHE_KEY}:${MARKDOWN_HTML_CACHE_VERSION}:${variant}:${hash}`
}

const withCacheTimeout = async <T>(operation: Promise<T>, fallback: T) => {
  let timeout: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      operation,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => {
          disableMarkdownHtmlCache()
          resolve(fallback)
        }, MARKDOWN_HTML_CACHE_TIMEOUT_MS)
      })
    ])
  } catch {
    disableMarkdownHtmlCache()
    return fallback
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

const readMarkdownHtmlCache = async (cacheKey: string) => {
  if (!isMarkdownHtmlCacheAvailable()) {
    return null
  }

  return withCacheTimeout(
    (async () => {
      const { getKv } = await import('~/lib/redis')
      return await getKv(cacheKey)
    })(),
    null
  )
}

const deleteMarkdownHtmlCache = async (cacheKey: string) => {
  if (!isMarkdownHtmlCacheAvailable()) {
    return
  }

  await withCacheTimeout(
    (async () => {
      const { delKv } = await import('~/lib/redis')
      await delKv(cacheKey)
    })(),
    undefined
  )
}

const renderWithTimeout = async (
  render: MarkdownHtmlRenderer
): Promise<string> => {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      render(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('markdown html render timed out'))
        }, MARKDOWN_HTML_RENDER_TIMEOUT_MS)
      })
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

const writeMarkdownHtmlCache = async (
  cacheKey: string,
  html: string,
  ttlSeconds: number
) => {
  if (!isMarkdownHtmlCacheAvailable()) {
    return
  }

  await withCacheTimeout(
    (async () => {
      const { setKv } = await import('~/lib/redis')
      await setKv(cacheKey, html, ttlSeconds)
    })(),
    undefined
  )
}

export const renderMarkdownHtmlWithCache = async (
  variant: MarkdownHtmlCacheVariant,
  markdown: string,
  render: MarkdownHtmlRenderer,
  options: MarkdownHtmlCacheOptions = {}
) => {
  const {
    enabled = true,
    ttlSeconds = MARKDOWN_HTML_CACHE_DURATION,
    maxMarkdownBytes = MARKDOWN_HTML_CACHE_MAX_MARKDOWN_BYTES,
    maxHtmlBytes = MARKDOWN_HTML_CACHE_MAX_HTML_BYTES
  } = options

  if (
    !enabled ||
    ttlSeconds <= 0 ||
    !isWithinByteLimit(markdown, maxMarkdownBytes)
  ) {
    return renderWithTimeout(render)
  }

  const cacheKey = getMarkdownHtmlCacheKey(variant, markdown)

  const existing = inFlightRenders.get(cacheKey)
  if (existing) {
    return existing
  }

  const pending = (async () => {
    const cachedHtml = await readMarkdownHtmlCache(cacheKey)

    if (cachedHtml !== null) {
      if (isWithinByteLimit(cachedHtml, maxHtmlBytes)) {
        return cachedHtml
      }

      await deleteMarkdownHtmlCache(cacheKey)
    }

    const html = await renderWithTimeout(render)
    if (isWithinByteLimit(html, maxHtmlBytes)) {
      await writeMarkdownHtmlCache(cacheKey, html, ttlSeconds)
    }

    return html
  })()

  inFlightRenders.set(cacheKey, pending)

  try {
    return await pending
  } finally {
    inFlightRenders.delete(cacheKey)
  }
}
