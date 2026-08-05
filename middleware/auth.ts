import { NextResponse } from 'next/server'
import { parseCookies } from '~/utils/cookies'
import { verifyKunTokenEdge } from '~/app/api/utils/jwtEdge'
import type { NextRequest } from 'next/server'

// 必须与 proxy.ts 的 config.matcher 保持同步: matcher 决定中间件是否运行,
// 本表决定运行后是否拦截, 任一侧缺项都会让登录保护静默失效。
// Next 要求 matcher 为字面量, 无法从此处推导, 故由
// middleware/__tests__/auth-matcher.test.ts 断言两者一致。
export const protectedPaths = ['/admin', '/user', '/edit']

const domain =
  process.env.NODE_ENV === 'development'
    ? process.env.NEXT_PUBLIC_KUN_PATCH_ADDRESS_DEV
    : process.env.NEXT_PUBLIC_KUN_PATCH_ADDRESS_PROD

export const isProtectedRoute = (pathname: string) =>
  protectedPaths.some((path) => pathname.startsWith(path))

const redirectToLogin = (request: NextRequest) => {
  const loginUrl = new URL('/login', domain)
  // loginUrl.searchParams.set('from', request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

const getToken = (request: NextRequest) => {
  const cookies = parseCookies(request.headers.get('cookie') ?? '')
  return cookies['kun-galgame-patch-moe-token']
}

export const kunAuthMiddleware = async (request: NextRequest) => {
  const { pathname } = request.nextUrl

  if (!isProtectedRoute(pathname)) {
    return NextResponse.next()
  }

  const payload = await verifyKunTokenEdge(getToken(request) ?? '')
  if (!payload) {
    return redirectToLogin(request)
  }

  return NextResponse.next()
}
