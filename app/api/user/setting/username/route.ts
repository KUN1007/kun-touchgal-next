import { NextRequest, NextResponse } from 'next/server'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { prisma } from '~/prisma/index'
import { usernameSchema } from '~/validations/user'
import { invalidateUserSession } from '~/app/api/user/session/cache'

const updateUsername = async (username: string, uid: number) => {
  const user = await prisma.user.findUnique({ where: { id: uid } })
  if (!user) {
    return '用户未找到'
  }
  if (user.moemoepoint < 30) {
    return '更改用户名最少需要 30 萌萌点, 您的萌萌点不足'
  }

  const normalizedName = username.toLowerCase()
  const sameUsernameUser = await prisma.user.findFirst({
    where: { name: { equals: normalizedName, mode: 'insensitive' } }
  })
  if (sameUsernameUser) {
    return '您的用户名已经有人注册了, 请修改'
  }

  await prisma.user.update({
    where: { id: uid },
    data: { name: username, moemoepoint: { increment: -30 } }
  })
  await invalidateUserSession(uid)
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, usernameSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const res = await updateUsername(input.username, payload.uid)
  if (typeof res === 'string') {
    return NextResponse.json(res)
  }

  return NextResponse.json({})
}
