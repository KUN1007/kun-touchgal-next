import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findFirstMock, createMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  createMock: vi.fn()
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    user_message: { findFirst: findFirstMock, create: createMock }
  }
}))

import { createLinkDedupMessage } from '~/app/api/utils/message'

const data = {
  type: 'comment' as const,
  content: '评论了您发布的资源：new content',
  sender_id: 7,
  recipient_id: 3,
  link: '/patch-10/resource/5?commentId=11'
}

beforeEach(() => {
  vi.clearAllMocks()
  createMock.mockResolvedValue({ id: 1 })
})

describe('createLinkDedupMessage', () => {
  it('去重键不含 content: 同 link 已有通知 (旧正文) 时跳过创建', async () => {
    findFirstMock.mockResolvedValue({ id: 99 })

    await createLinkDedupMessage(data)

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        type: 'comment',
        sender_id: 7,
        recipient_id: 3,
        link: '/patch-10/resource/5?commentId=11'
      }
    })
    expect(createMock).not.toHaveBeenCalled()
  })

  it('无同 link 通知时正常创建', async () => {
    findFirstMock.mockResolvedValue(null)

    await createLinkDedupMessage(data)

    expect(createMock).toHaveBeenCalledWith({ data })
  })
})
