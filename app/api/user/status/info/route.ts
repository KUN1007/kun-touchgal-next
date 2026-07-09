import { NextRequest, NextResponse } from 'next/server'
import { kunParseGetQuery } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { getUserProfileSchema } from '~/validations/user'
import { getUserProfile } from './service'

export async function GET(req: NextRequest) {
  const input = kunParseGetQuery(req, getUserProfileSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload?.uid) {
    return NextResponse.json('请先登录', { status: 401 })
  }

  const user = await getUserProfile(input, payload)
  return NextResponse.json(user)
}
