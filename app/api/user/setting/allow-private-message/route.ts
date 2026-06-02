import { prisma } from '~/prisma/index'
import { NextRequest, NextResponse } from 'next/server'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { invalidateUserSession } from '~/app/api/user/session/cache'

const toggleAllowPrivateMessage = async (uid: number) => {
  const user = await prisma.user.findUnique({
    where: { id: uid }
  })
  if (user === null) {
    return '未找到用户'
  }

  await prisma.user.update({
    where: { id: uid },
    data: { allow_private_message: !user.allow_private_message }
  })
  await invalidateUserSession(uid)
  return {}
}

export const POST = async (req: NextRequest) => {
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const res = await toggleAllowPrivateMessage(payload.uid)
  return NextResponse.json(res)
}
