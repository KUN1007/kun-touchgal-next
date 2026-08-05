import { prisma } from '~/prisma/index'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { enableEmailNoticeSchema } from '~/validations/user'
import { invalidateUserSession } from '~/app/api/user/session/cache'

const updateEmailNotice = async (uid: number, enableEmailNotice: boolean) => {
  const { count } = await prisma.user.updateMany({
    where: { id: uid },
    data: { enable_email_notice: enableEmailNotice }
  })
  if (count === 0) {
    return '未找到用户'
  }

  await invalidateUserSession(uid)
  return {}
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, enableEmailNoticeSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const res = await updateEmailNotice(payload.uid, input.enableEmailNotice)
  return NextResponse.json(res)
}
