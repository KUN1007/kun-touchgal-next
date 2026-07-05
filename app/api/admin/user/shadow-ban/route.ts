import { NextRequest, NextResponse } from 'next/server'
import { kunParsePutBody } from '~/app/api/utils/parseQuery'
import { adminUpdateUserShadowBanSchema } from '~/validations/admin'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { updateUserShadowBan } from './shadowBan'

export const PUT = async (req: NextRequest) => {
  const input = await kunParsePutBody(req, adminUpdateUserShadowBanSchema)
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

  const response = await updateUserShadowBan(input, payload.uid)
  return NextResponse.json(response)
}
