import { NextRequest, NextResponse } from 'next/server'
import { kunParseGetQuery } from '~/app/api/utils/parseQuery'
import { adminPaginationSchema } from '~/validations/admin'
import { getNSFWHeader } from '~/app/api/utils/getNSFWHeader'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { getPatchResourceApply } from './get'

export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, adminPaginationSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('未登录')
  }
  if (payload.role < 3) {
    return NextResponse.json('权限不足')
  }

  const nsfwEnable = getNSFWHeader(req)

  const res = await getPatchResourceApply(input, nsfwEnable)
  return NextResponse.json(res)
}
