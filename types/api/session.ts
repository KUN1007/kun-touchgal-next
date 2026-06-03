import type { MessageUnreadStatus } from './message'
import type { UserState } from '~/store/userStore'

export interface UserSession {
  user: UserState
  unread: MessageUnreadStatus
}

export interface LoginSession {
  id: string
  tokenId: string
  userAgent: string
  ip: string
  createdAt: number
  lastActiveAt: number
  isCurrent: boolean
}

export interface RevokeLoginSessionResponse {
  revokedCurrent: boolean
}

export interface RevokeOtherLoginSessionsResponse {
  revokedCount: number
}
