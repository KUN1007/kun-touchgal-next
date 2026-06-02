import { NextRequest, NextResponse } from 'next/server'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { prisma } from '~/prisma/index'
import { bioSchema } from '~/validations/user'
import { invalidateUserSession } from '~/app/api/user/session/cache'

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, bioSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  await prisma.user.update({
    where: { id: payload.uid },
    data: { bio: input.bio }
  })
  await invalidateUserSession(payload.uid)

  return NextResponse.json({})
}
