import { NextRequest, NextResponse } from 'next/server'
import { kunParsePutBody } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { adminUpdateRedirectSchema } from '~/validations/admin'
import { setKv } from '~/lib/redis'
import { getRedirectConfig } from './getRedirectConfig'
import { invalidateAllUserSessions } from '~/app/api/user/session/cache'
import type { AdminRedirectConfig } from '~/types/api/admin'

const REDIS_KEY = 'admin:config:redirect'

export const GET = async (req: NextRequest) => {
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }
  if (payload.role < 4) {
    return NextResponse.json('本页面仅超级管理员可访问')
  }

  const config = await getRedirectConfig()
  return NextResponse.json(config)
}

export const PUT = async (req: NextRequest) => {
  const input = await kunParsePutBody(req, adminUpdateRedirectSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }
  if (payload.role < 4) {
    return NextResponse.json('本页面仅超级管理员可访问')
  }

  await setKv(
    REDIS_KEY,
    JSON.stringify(input as AdminRedirectConfig),
    365 * 24 * 60 * 60
  )
  await invalidateAllUserSessions()
  return NextResponse.json({})
}
