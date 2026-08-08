// eslint-disable-next-line no-control-regex -- 匹配控制字符正是本模式的用途
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/

export const SAFE_LINK_PROTOCOLS = [
  'http:',
  'https:',
  'mailto:',
  'irc:',
  'ircs:',
  'xmpp:',
  'magnet:',
  'ed2k:',
  'thunder:'
] as const
export const SAFE_MEDIA_PROTOCOLS = ['http:', 'https:'] as const
export const SAFE_LINK_PROTOCOL_NAMES = SAFE_LINK_PROTOCOLS.map((protocol) =>
  protocol.slice(0, -1)
)
export const SAFE_MEDIA_PROTOCOL_NAMES = SAFE_MEDIA_PROTOCOLS.map((protocol) =>
  protocol.slice(0, -1)
)

const getExplicitProtocol = (value: string) => {
  const match = value.match(/^([a-zA-Z][a-zA-Z\d+.-]*):/)
  return match ? `${match[1].toLowerCase()}:` : null
}

export const sanitizeUserUrl = (
  url: string,
  allowedProtocols: readonly string[] = SAFE_LINK_PROTOCOLS
) => {
  const trimmedUrl = url.trim()

  if (!trimmedUrl || CONTROL_CHARACTER_PATTERN.test(trimmedUrl)) {
    return null
  }

  const protocolMatch = trimmedUrl.match(/^([a-zA-Z][a-zA-Z\d+.-]*):/)
  if (!protocolMatch) {
    return trimmedUrl
  }

  const protocol = `${protocolMatch[1].toLowerCase()}:`

  return allowedProtocols.includes(protocol)
    ? `${protocol}${trimmedUrl.slice(protocolMatch[0].length)}`
    : null
}

export const sanitizeUserHref = (url: string) =>
  sanitizeUserUrl(url, SAFE_LINK_PROTOCOLS)

export const isHttpLikeUrl = (url: string) => {
  const protocol = getExplicitProtocol(url)
  return protocol === 'http:' || protocol === 'https:' || url.startsWith('//')
}

export const getHttpUrlHostname = (url: string) => {
  if (!isHttpLikeUrl(url)) {
    return null
  }

  try {
    const parsedUrl = new URL(url, 'https://kun.local')
    return parsedUrl.hostname.toLowerCase()
  } catch {
    return null
  }
}

export const isRedirectableUrl = isHttpLikeUrl

export const normalizeDomain = (domain: string) =>
  domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^\.+/, '')

export const isHostnameExcluded = (hostname: string, domains?: string[]) => {
  return (
    domains?.some((domain) => {
      const normalizedDomain = normalizeDomain(domain)

      return (
        normalizedDomain &&
        (hostname === normalizedDomain ||
          hostname.endsWith(`.${normalizedDomain}`))
      )
    }) ?? false
  )
}
