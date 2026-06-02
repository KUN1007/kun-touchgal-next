import { NextRequest, NextResponse } from 'next/server'
import { getUserSessionByToken } from '~/app/api/user/session/service'

export const GET = async (req: NextRequest) => {
  const session = await getUserSessionByToken(
    req.cookies.get('kun-galgame-patch-moe-token')?.value ?? ''
  )
  if (!session) {
    return NextResponse.json('用户登陆失效')
  }

  return NextResponse.json(session)
}
