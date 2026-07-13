import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  verifyHeaderCookieMock,
  conversationFindUniqueMock,
  conversationUpdateMock,
  privateMessageUpdateManyMock,
  getUnreadMessageStatusMock,
  invalidateUnreadMock
} = vi.hoisted(() => ({
  verifyHeaderCookieMock: vi.fn(),
  conversationFindUniqueMock: vi.fn(),
  conversationUpdateMock: vi.fn(),
  privateMessageUpdateManyMock: vi.fn(),
  getUnreadMessageStatusMock: vi.fn(),
  invalidateUnreadMock: vi.fn()
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' }
      })
  }
}))

vi.mock('~/middleware/_verifyHeaderCookie', () => ({
  verifyHeaderCookie: verifyHeaderCookieMock
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    user_conversation: {
      findUnique: conversationFindUniqueMock,
      update: conversationUpdateMock
    },
    user_private_message: { updateMany: privateMessageUpdateManyMock }
  }
}))

vi.mock('~/app/api/message/unread/service', () => ({
  getUnreadMessageStatus: getUnreadMessageStatusMock
}))

vi.mock('~/app/api/message/unread/cache', () => ({
  invalidateUnread: invalidateUnreadMock
}))

import { PUT } from '~/app/api/message/conversation/[id]/read/route'

const UID = 7
const params = Promise.resolve({ id: '1' })

describe('conversation/[id]/read PUT', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyHeaderCookieMock.mockResolvedValue({ uid: UID })
    conversationFindUniqueMock.mockResolvedValue({
      id: 1,
      user_a_id: UID,
      user_b_id: 99
    })
    conversationUpdateMock.mockResolvedValue({})
    privateMessageUpdateManyMock.mockResolvedValue({ count: 0 })
    invalidateUnreadMock.mockResolvedValue(undefined)
    getUnreadMessageStatusMock.mockResolvedValue({
      hasUnreadNotification: false,
      hasUnreadConversation: false
    })
  })

  it('invalidates the unread cache before recomputing status', async () => {
    const res = await PUT({} as never, { params })

    expect(invalidateUnreadMock).toHaveBeenCalledWith(UID)
    expect(getUnreadMessageStatusMock).toHaveBeenCalledWith(UID)
    expect(invalidateUnreadMock.mock.invocationCallOrder[0]).toBeLessThan(
      getUnreadMessageStatusMock.mock.invocationCallOrder[0]
    )
    expect(await res.json()).toEqual({
      hasUnreadNotification: false,
      hasUnreadConversation: false
    })
  })

  it('does not invalidate when the conversation is inaccessible', async () => {
    conversationFindUniqueMock.mockResolvedValue({
      id: 1,
      user_a_id: 100,
      user_b_id: 200
    })

    await PUT({} as never, { params })

    expect(invalidateUnreadMock).not.toHaveBeenCalled()
    expect(getUnreadMessageStatusMock).not.toHaveBeenCalled()
  })
})
