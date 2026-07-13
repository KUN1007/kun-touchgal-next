import { getKv, setKv, delKv } from '~/lib/redis'
import type { MessageUnreadStatus } from '~/types/api/message'

const MESSAGE_UNREAD_CACHE_TTL_SECONDS = 30

const getMessageUnreadCacheKey = (uid: number) => `message:unread:${uid}`

export const getCachedUnread = async (
  uid: number
): Promise<MessageUnreadStatus | null> => {
  const cached = await getKv(getMessageUnreadCacheKey(uid))
  if (!cached) {
    return null
  }

  try {
    const status = JSON.parse(cached) as Partial<MessageUnreadStatus>
    if (
      typeof status.hasUnreadNotification !== 'boolean' ||
      typeof status.hasUnreadConversation !== 'boolean'
    ) {
      return null
    }

    return status as MessageUnreadStatus
  } catch {
    return null
  }
}

export const setCachedUnread = async (
  uid: number,
  status: MessageUnreadStatus
) => {
  await setKv(
    getMessageUnreadCacheKey(uid),
    JSON.stringify(status),
    MESSAGE_UNREAD_CACHE_TTL_SECONDS
  )
}

export const invalidateUnread = async (uid: number) => {
  try {
    await delKv(getMessageUnreadCacheKey(uid))
  } catch {
    // 失效失败不应阻断已读响应; 短 TTL 会在数十秒内兜底自愈
  }
}
