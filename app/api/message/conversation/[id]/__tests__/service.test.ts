import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  invalidateUnreadMock,
  conversationFindUniqueMock,
  conversationUpdateMock,
  privateMessageCreateMock
} = vi.hoisted(() => ({
  invalidateUnreadMock: vi.fn(),
  conversationFindUniqueMock: vi.fn(),
  conversationUpdateMock: vi.fn(),
  privateMessageCreateMock: vi.fn()
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    user_conversation: {
      findUnique: conversationFindUniqueMock,
      update: conversationUpdateMock
    },
    user_private_message: {
      create: privateMessageCreateMock
    }
  }
}))

vi.mock('~/app/api/message/unread/cache', () => ({
  invalidateUnread: invalidateUnreadMock
}))

import { sendMessage } from '~/app/api/message/conversation/[id]/service'

describe('sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateUnreadMock.mockResolvedValue(undefined)
  })

  it('应在发送私信后失效接收方的未读缓存', async () => {
    const conversationId = 1
    const senderId = 100
    const recipientId = 200
    const messageContent = 'test message'
    const messageId = 999
    const messageCreated = new Date()

    conversationFindUniqueMock.mockResolvedValue({
      id: conversationId,
      user_a_id: senderId,
      user_b_id: recipientId,
      user_a: { id: senderId, name: 'sender', avatar: '' },
      user_b: { id: recipientId, name: 'recipient', avatar: '' }
    })

    privateMessageCreateMock.mockResolvedValue({
      id: messageId,
      content: messageContent,
      created: messageCreated
    })

    conversationUpdateMock.mockResolvedValue({
      id: conversationId,
      user_b_unread_count: 1
    })

    const input = { content: messageContent }
    const result = await sendMessage(conversationId, input, senderId)

    expect(result).toEqual({
      id: messageId,
      content: messageContent,
      created: messageCreated
    })

    expect(invalidateUnreadMock).toHaveBeenCalledWith(recipientId)
  })

  it('当发送方是 user_b 时，应失效 user_a 的缓存', async () => {
    const conversationId = 2
    const senderId = 200
    const recipientId = 100
    const messageContent = 'test message 2'
    const messageId = 1000
    const messageCreated = new Date()

    conversationFindUniqueMock.mockResolvedValue({
      id: conversationId,
      user_a_id: recipientId,
      user_b_id: senderId,
      user_a: { id: recipientId, name: 'user_a', avatar: '' },
      user_b: { id: senderId, name: 'user_b', avatar: '' }
    })

    privateMessageCreateMock.mockResolvedValue({
      id: messageId,
      content: messageContent,
      created: messageCreated
    })

    conversationUpdateMock.mockResolvedValue({
      id: conversationId,
      user_a_unread_count: 1
    })

    const input = { content: messageContent }
    await sendMessage(conversationId, input, senderId)

    expect(invalidateUnreadMock).toHaveBeenCalledWith(recipientId)
  })

  it('缓存失效失败不应阻断响应', async () => {
    const conversationId = 3
    const senderId = 300
    const recipientId = 400
    const messageContent = 'test message 3'
    const messageId = 1001
    const messageCreated = new Date()

    conversationFindUniqueMock.mockResolvedValue({
      id: conversationId,
      user_a_id: senderId,
      user_b_id: recipientId,
      user_a: { id: senderId, name: 'sender', avatar: '' },
      user_b: { id: recipientId, name: 'recipient', avatar: '' }
    })

    privateMessageCreateMock.mockResolvedValue({
      id: messageId,
      content: messageContent,
      created: messageCreated
    })

    conversationUpdateMock.mockResolvedValue({
      id: conversationId,
      user_b_unread_count: 1
    })

    invalidateUnreadMock.mockRejectedValue(new Error('Redis error'))

    const input = { content: messageContent }
    const result = await sendMessage(conversationId, input, senderId)

    expect(result).toEqual({
      id: messageId,
      content: messageContent,
      created: messageCreated
    })

    expect(invalidateUnreadMock).toHaveBeenCalledWith(recipientId)
  })
})
