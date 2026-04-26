import { NextRequest, NextResponse } from 'next/server'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { getUserStatus } from './service'

export async function GET(req: NextRequest) {
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户登陆失效')
  }

  const status = await getUserStatus(payload.uid)
  return NextResponse.json(status)
}
