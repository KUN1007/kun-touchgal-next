import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { kunParseDeleteQuery } from '~/app/api/utils/parseQuery'
import {
  deleteKunTokenSession,
  deleteOtherKunTokenSessions,
  getKunLoginSessions
} from '~/app/api/utils/jwt'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { revokeLoginSessionSchema } from '~/validations/user'

export const GET = async (req: NextRequest) => {
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const response = await getKunLoginSessions(payload.uid, payload.jti)
  return NextResponse.json(response)
}

export const POST = async (req: NextRequest) => {
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const revokedCount = await deleteOtherKunTokenSessions(
    payload.uid,
    payload.jti
  )
  return NextResponse.json({ revokedCount })
}

export const DELETE = async (req: NextRequest) => {
  const input = kunParseDeleteQuery(req, revokeLoginSessionSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const revoked = await deleteKunTokenSession(payload.uid, input.sessionId)
  if (!revoked) {
    return NextResponse.json('登录会话不存在或已失效')
  }

  const revokedCurrent = input.sessionId === payload.jti
  if (revokedCurrent) {
    const cookie = await cookies()
    cookie.delete('kun-galgame-patch-moe-token')
  }

  return NextResponse.json({ revokedCurrent })
}
