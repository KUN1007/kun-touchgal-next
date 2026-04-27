import type { NextRequest } from 'next/server'

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// 这些端点使用一次性令牌（来自邮件链接）作为凭证, 不依赖会话 cookie,
// 因此本身已具备防伪造能力, 也无法附加 X-Requested-With 头 (原生 form 提交)。
const CSRF_EXEMPT_PATHS = new Set(['/api/user/setting/email/revert'])

export const KUN_CSRF_HEADER = 'x-requested-with'
export const KUN_CSRF_HEADER_VALUE = 'kun-fetch'

const parseHost = (value: string): string | null => {
  try {
    return new URL(value).host
  } catch {
    return null
  }
}

const getAllowedHosts = (): Set<string> => {
  const candidates = [
    process.env.NEXT_PUBLIC_KUN_PATCH_ADDRESS_DEV,
    process.env.NEXT_PUBLIC_KUN_PATCH_ADDRESS_PROD
  ]

  const hosts = new Set<string>()
  for (const candidate of candidates) {
    if (!candidate) continue
    const host = parseHost(candidate)
    if (host) hosts.add(host)
  }
  return hosts
}

export const verifyKunCsrf = (req: NextRequest): string | null => {
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    return null
  }

  if (CSRF_EXEMPT_PATHS.has(req.nextUrl.pathname)) {
    return null
  }

  if (req.headers.get(KUN_CSRF_HEADER) !== KUN_CSRF_HEADER_VALUE) {
    return '非法请求来源'
  }

  const allowed = getAllowedHosts()
  if (allowed.size === 0) {
    return '服务端未配置允许的请求来源'
  }

  const origin = req.headers.get('origin')
  if (origin) {
    const host = parseHost(origin)
    return host && allowed.has(host) ? null : '非法请求来源'
  }

  const referer = req.headers.get('referer')
  if (referer) {
    const host = parseHost(referer)
    return host && allowed.has(host) ? null : '非法请求来源'
  }

  return '非法请求来源'
}
