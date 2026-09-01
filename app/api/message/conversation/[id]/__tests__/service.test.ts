import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  txState,
  invalidateUnreadMock,
  conversationFindUniqueMock,
  conversationUpdateMock,
  privateMessageCreateMock,
  privateMessageFindManyMock,
  privateMessageCountMock
} = vi.hoisted(() => ({
  txState: { committed: false },
  invalidateUnreadMock: vi.fn(),
  conversationFindUniqueMock: vi.fn(),
  conversationUpdateMock: vi.fn(),
  privateMessageCreateMock: vi.fn(),
  privateMessageFindManyMock: vi.fn(),
  privateMessageCountMock: vi.fn()
}))

// 写入 mock 只挂在 tx 客户端上: create 或递增退回顶层 prisma 直调 (非事务) 时
// 用例会因 undefined 直接崩. 回调正常返回即提交, 只有抛出才回滚
vi.mock('~/prisma/index', () => ({
  prisma: {
    user_conversation: {
      findUnique: conversationFindUniqueMock
    },
    user_private_message: {
      findMany: privateMessageFindManyMock,
      count: privateMessageCountMock
    },
    $transaction: async (callback: (tx: unknown) => unknown) => {
      const result = await callback({
        user_conversation: { update: conversationUpdateMock },
        user_private_message: { create: privateMessageCreateMock }
      })
      txState.committed = true
      return result
    }
  }
}))

vi.mock('~/app/api/message/unread/cache', () => ({
  invalidateUnread: invalidateUnreadMock
}))

import {
  getConversationMessages,
  sendMessage
} from '~/app/api/message/conversation/[id]/service'

describe('sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    txState.committed = false
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

  it('create 失败时整个事务回滚, 计数不递增也不失效缓存', async () => {
    conversationFindUniqueMock.mockResolvedValue({
      id: 4,
      user_a_id: 500,
      user_b_id: 600,
      user_a: { id: 500, name: 'sender', avatar: '' },
      user_b: { id: 600, name: 'recipient', avatar: '' }
    })

    privateMessageCreateMock.mockRejectedValue(new Error('insert failed'))

    await expect(sendMessage(4, { content: 'x' }, 500)).rejects.toThrow(
      'insert failed'
    )

    // create 与递增拆成两条自动提交语句时, 这里会出现「消息没落库但计数 +1」
    expect(conversationUpdateMock).not.toHaveBeenCalled()
    expect(txState.committed).toBe(false)
    expect(invalidateUnreadMock).not.toHaveBeenCalled()
  })
})

describe('getConversationMessages', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    conversationFindUniqueMock.mockResolvedValue({
      id: 1,
      user_a_id: 100,
      user_b_id: 200,
      user_a: { id: 100, name: 'sender', avatar: '' },
      user_b: { id: 200, name: 'recipient', avatar: '' }
    })
  })

  it('已删除消息的原文不下发, content 在 API 边界置空', async () => {
    const created = new Date()
    privateMessageFindManyMock.mockResolvedValue([
      {
        id: 2,
        content: 'secret',
        status: 0,
        is_deleted: true,
        edited_at: null,
        created,
        sender: { id: 100, name: 'sender', avatar: '' }
      },
      {
        id: 1,
        content: 'hello',
        status: 0,
        is_deleted: false,
        edited_at: null,
        created,
        sender: { id: 200, name: 'recipient', avatar: '' }
      }
    ])
    privateMessageCountMock.mockResolvedValue(2)

    const result = await getConversationMessages(1, { page: 1, limit: 30 }, 100)

    // 客户端只按 isDeleted 换占位渲染, 遮蔽必须发生在服务端: 原文一旦进响应体,
    // 对端从 DevTools 就能读到被撤回的内容
    expect(result).toMatchObject({
      total: 2,
      messages: [
        { id: 2, content: '', isDeleted: true },
        { id: 1, content: 'hello', isDeleted: false }
      ]
    })
  })
})
