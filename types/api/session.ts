import type { MessageUnreadStatus } from './message'
import type { UserState } from '~/store/userStore'

export interface UserSession {
  user: UserState
  unread: MessageUnreadStatus
}
