import { cache } from 'react'
import { cookies } from 'next/headers'
import { verifyKunTokenPayload, deleteKunToken } from '~/app/api/utils/jwt'
import {
  getUserStatus,
  touchUserLastActiveTime
} from '~/app/api/user/status/service'
import { getUnreadMessageStatus } from '~/app/api/message/unread/service'
import {
  getCachedUserSession,
  getUserSessionCacheScope,
  setCachedUserSession
} from '~/app/api/user/session/cache'
import type { UserSession } from '~/types/api/session'
import type { MessageUnreadStatus } from '~/types/api/message'
import type { UserState } from '~/store/userStore'

const emptyUnreadStatus: MessageUnreadStatus = {
  hasUnreadNotification: false,
  hasUnreadConversation: false
}

const getUserState = async (uid: number): Promise<UserState | null> => {
  const scope = await getUserSessionCacheScope(uid).catch(() => null)
  const cached = scope
    ? await getCachedUserSession(uid, scope).catch(() => null)
    : null
  if (cached) {
    return cached.user
  }

  const user = await getUserStatus(uid).catch(() => null)
  if (!user) {
    return null
  }
  if (typeof user === 'string') {
    await deleteKunToken(uid)
    return null
  }

  await touchUserLastActiveTime(uid)
  if (scope) {
    await setCachedUserSession(uid, user, scope).catch(() => undefined)
  }
  return user
}

export const getUserSessionByToken = async (
  token: string
): Promise<UserSession | null> => {
  const payload = await verifyKunTokenPayload(token)
  if (!payload) {
    return null
  }

  const [user, unread] = await Promise.all([
    getUserState(payload.uid),
    getUnreadMessageStatus(payload.uid).catch(() => emptyUnreadStatus)
  ])
  if (!user) {
    return null
  }

  return { user, unread }
}

const getCachedUserSessionByToken = cache(getUserSessionByToken)

export const getServerUserSession = async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get('kun-galgame-patch-moe-token')?.value

  return token ? getCachedUserSessionByToken(token) : null
}
