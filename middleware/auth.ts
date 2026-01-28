import { NextResponse } from 'next/server'
import { parseCookies } from '~/utils/cookies'
import type { NextRequest } from 'next/server'

const protectedPaths = ['/admin', '/user', '/comment', '/edit']

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
  const token = getToken(request)

  if (isProtectedRoute(pathname) && !token) {
    return redirectToLogin(request)
  }

  return NextResponse.next()
}
