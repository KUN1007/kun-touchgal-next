import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { getUnreadMessageStatus } from '~/app/api/message/unread/service'

const markConversationAsRead = async (conversationId: number, uid: number) => {
  const conversation = await prisma.user_conversation.findUnique({
    where: { id: conversationId }
  })

  if (!conversation) {
    return '会话不存在'
  }

  if (conversation.user_a_id !== uid && conversation.user_b_id !== uid) {
    return '无权访问此会话'
  }

  const isUserA = conversation.user_a_id === uid

  await prisma.user_private_message.updateMany({
    where: {
      conversation_id: conversationId,
      sender_id: isUserA ? conversation.user_b_id : conversation.user_a_id,
      status: 0
    },
    data: { status: 1 }
  })

  await prisma.user_conversation.update({
    where: { id: conversationId },
    data: isUserA ? { user_a_unread_count: 0 } : { user_b_unread_count: 0 }
  })

  return {}
}

export const PUT = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const conversationId = parseInt(id, 10)
  if (isNaN(conversationId)) {
    return NextResponse.json('无效的会话 ID')
  }

  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const readResponse = await markConversationAsRead(conversationId, payload.uid)
  if (typeof readResponse === 'string') {
    return NextResponse.json(readResponse)
  }

  const response = await getUnreadMessageStatus(payload.uid)
  return NextResponse.json(response)
}
