import { NextRequest, NextResponse } from 'next/server'
import { kunParseGetQuery, kunParsePostBody } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { getUserAppealSchema, submitAppealSchema } from '~/validations/appeal'
import { getUserAppeals } from './get'
import { submitAppeal } from './submit'

export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, getUserAppealSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const response = await getUserAppeals(payload.uid, input)
  return NextResponse.json(response)
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, submitAppealSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const response = await submitAppeal(input, payload.uid)
  return NextResponse.json(response)
}
