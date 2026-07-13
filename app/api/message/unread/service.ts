import { prisma } from '~/prisma/index'
import {
  getCachedUnread,
  setCachedUnread
} from '~/app/api/message/unread/cache'
import type { MessageUnreadStatus } from '~/types/api/message'

export const getUnreadMessageStatus = async (
  uid: number
): Promise<MessageUnreadStatus> => {
  const cached = await getCachedUnread(uid).catch(() => null)
  if (cached) {
    return cached
  }

  const [unreadNotification, unreadConversation] = await Promise.all([
    prisma.user_message.findFirst({
      where: { recipient_id: uid, status: 0 },
      select: { id: true }
    }),
    prisma.user_conversation.findFirst({
      where: {
        OR: [
          { user_a_id: uid, user_a_unread_count: { gt: 0 } },
          { user_b_id: uid, user_b_unread_count: { gt: 0 } }
        ]
      },
      select: { id: true }
    })
  ])

  const status: MessageUnreadStatus = {
    hasUnreadNotification: !!unreadNotification,
    hasUnreadConversation: !!unreadConversation
  }

  await setCachedUnread(uid, status).catch(() => undefined)
  return status
}
