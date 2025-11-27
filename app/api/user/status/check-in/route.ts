import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { randomNormalInt } from '~/utils/random'

const checkIn = async (uid: number) => {
  const user = await prisma.user.findUnique({
    where: { id: uid }
  })
  if (!user) {
    return '用户未找到'
  }
  if (user.daily_check_in) {
    return '您今天已经签到过了'
  }

  const randomMoemoepoints = randomNormalInt(2, 7)

  await prisma.user.update({
    where: { id: uid },
    data: {
      moemoepoint: { increment: randomMoemoepoints },
      daily_check_in: { set: 1 }
    }
  })

  return { randomMoemoepoints }
}

export async function POST(req: NextRequest) {
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const res = await checkIn(payload.uid)
  return NextResponse.json(res)
}
