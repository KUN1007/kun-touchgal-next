import { prisma } from '~/prisma/index'
import { NextRequest, NextResponse } from 'next/server'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { invalidateUserSession } from '~/app/api/user/session/cache'

const toggleEmailNotice = async (uid: number) => {
  const user = await prisma.user.findUnique({
    where: { id: uid }
  })
  if (user === null) {
    return '未找到用户'
  }

  await prisma.user.update({
    where: { id: uid },
    data: { enable_email_notice: !user.enable_email_notice }
  })
  await invalidateUserSession(uid)
  return {}
}

export const POST = async (req: NextRequest) => {
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const res = await toggleEmailNotice(payload.uid)
  return NextResponse.json(res)
}
