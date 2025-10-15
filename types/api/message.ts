import { MESSAGE_TYPE } from '~/constants/message'

export interface Message {
  id: number
  type: string
  content: string
  status: number
  link: string
  created: string | Date
  sender: KunUser | null
}

export interface CreateMessageType {
  type: (typeof MESSAGE_TYPE)[number]
  content: string
  link: string
  sender_id?: number
  recipient_id?: number
}
