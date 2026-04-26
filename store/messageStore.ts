import { create } from 'zustand'
import type { MessageUnreadStatus } from '~/types/api/message'

interface MessageStore extends MessageUnreadStatus {
  setUnreadMessageStatus: (status: MessageUnreadStatus) => void
  setHasUnreadNotification: (hasUnreadNotification: boolean) => void
  setHasUnreadConversation: (hasUnreadConversation: boolean) => void
  resetUnreadMessageStatus: () => void
}

const initialUnreadMessageStatus: MessageUnreadStatus = {
  hasUnreadNotification: false,
  hasUnreadConversation: false
}

export const useMessageStore = create<MessageStore>()((set) => ({
  ...initialUnreadMessageStatus,
  setUnreadMessageStatus: (status) => set(status),
  setHasUnreadNotification: (hasUnreadNotification) =>
    set({ hasUnreadNotification }),
  setHasUnreadConversation: (hasUnreadConversation) =>
    set({ hasUnreadConversation }),
  resetUnreadMessageStatus: () => set(initialUnreadMessageStatus)
}))
