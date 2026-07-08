import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'

// 供账户设置页读取自身头像/签名审核状态, 刷新后仍能持久展示「审核中」提示
export const GET = async (req: NextRequest) => {
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: { avatar_status: true, bio_status: true }
  })
  if (!user) {
    return NextResponse.json('未找到用户')
  }

  return NextResponse.json({
    avatarPending: user.avatar_status === 1,
    bioPending: user.bio_status === 1
  })
}
