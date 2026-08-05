import { prisma } from '~/prisma/index'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { allowPrivateMessageSchema } from '~/validations/user'
import { invalidateUserSession } from '~/app/api/user/session/cache'

const updateAllowPrivateMessage = async (
  uid: number,
  allowPrivateMessage: boolean
) => {
  const { count } = await prisma.user.updateMany({
    where: { id: uid },
    data: { allow_private_message: allowPrivateMessage }
  })
  if (count === 0) {
    return '未找到用户'
  }

  await invalidateUserSession(uid)
  return {}
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, allowPrivateMessageSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const res = await updateAllowPrivateMessage(
    payload.uid,
    input.allowPrivateMessage
  )
  return NextResponse.json(res)
}
