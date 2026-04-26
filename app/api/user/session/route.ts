import { NextRequest, NextResponse } from 'next/server'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { getUnreadMessageStatus } from '~/app/api/message/unread/service'
import { getUserStatus } from '~/app/api/user/status/service'
import type { UserSession } from '~/types/api/session'
import type { MessageUnreadStatus } from '~/types/api/message'

const emptyUnreadStatus: MessageUnreadStatus = {
  hasUnreadNotification: false,
  hasUnreadConversation: false
}

export const GET = async (req: NextRequest) => {
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户登陆失效')
  }

  const [userResult, unreadResult] = await Promise.allSettled([
    getUserStatus(payload.uid),
    getUnreadMessageStatus(payload.uid)
  ])
  if (userResult.status === 'rejected') {
    throw userResult.reason
  }

  const user = userResult.value
  if (typeof user === 'string') {
    return NextResponse.json(user)
  }

  const unread =
    unreadResult.status === 'fulfilled' ? unreadResult.value : emptyUnreadStatus

  const response: UserSession = { user, unread }
  return NextResponse.json(response)
}
