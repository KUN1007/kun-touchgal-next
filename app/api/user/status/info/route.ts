import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParseGetQuery } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { getUserProfile } from './service'

const getProfileSchema = z.object({
  id: z.coerce.number().min(1).max(9999999)
})
export async function GET(req: NextRequest) {
  const input = kunParseGetQuery(req, getProfileSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload?.uid) {
    return NextResponse.json('请先登录', { status: 401 })
  }

  const user = await getUserProfile(input, payload.uid)
  return NextResponse.json(user)
}
