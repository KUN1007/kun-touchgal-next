import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  findUniqueMock,
  transactionMock,
  queryRawMock,
  childFindManyMock,
  deleteMock,
  messageDeleteManyMock,
  deletePendingModerationTasksMock,
  deletePendingAppealsMock,
  collectPendingReportIdsMock,
  deleteReportsByIdsMock,
  invalidateCommentCacheMock,
  invalidateContentMock
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  queryRawMock: vi.fn(),
  childFindManyMock: vi.fn(),
  deleteMock: vi.fn(),
  messageDeleteManyMock: vi.fn(),
  deletePendingModerationTasksMock: vi.fn(),
  deletePendingAppealsMock: vi.fn(),
  collectPendingReportIdsMock: vi.fn(),
  deleteReportsByIdsMock: vi.fn(),
  invalidateCommentCacheMock: vi.fn(async () => undefined),
  invalidateContentMock: vi.fn(async () => undefined)
}))

const transactionClient = {
  $queryRaw: queryRawMock,
  patch_comment: { findMany: childFindManyMock, delete: deleteMock },
  user_message: { deleteMany: messageDeleteManyMock }
}

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_comment: { findUnique: findUniqueMock },
    $transaction: transactionMock
  }
}))

vi.mock('~/server/moderation/submit', () => ({
  deletePendingModerationTasks: deletePendingModerationTasksMock
}))

vi.mock('~/server/moderation/appeal', () => ({
  deletePendingAppeals: deletePendingAppealsMock
}))

vi.mock('~/server/report/pending', () => ({
  collectPendingReportIds: collectPendingReportIdsMock,
  deleteReportsByIds: deleteReportsByIdsMock
}))

vi.mock('~/app/api/patch/comment/cache', () => ({
  invalidatePatchCommentCache: invalidateCommentCacheMock
}))

vi.mock('~/app/api/patch/cache', () => ({
  invalidatePatchContentCache: invalidateContentMock
}))

import { deleteComment } from '~/app/api/patch/comment/delete'

const baseComment = {
  id: 11,
  user_id: 7,
  parent_id: null,
  resource_id: null,
  patch_id: 10,
  status: 0,
  patch: { unique_id: 'patch-10' },
  parent: null,
  resource: null
}

beforeEach(() => {
  vi.clearAllMocks()
  queryRawMock.mockResolvedValue([{ id: 11 }])
  childFindManyMock.mockResolvedValue([])
  deleteMock.mockResolvedValue({})
  messageDeleteManyMock.mockResolvedValue({ count: 1 })
  collectPendingReportIdsMock.mockResolvedValue([])
  deleteReportsByIdsMock.mockResolvedValue(undefined)
  transactionMock.mockImplementation(
    async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient)
  )
})

describe('deleteComment 通知清理', () => {
  it('顶层资源评论删除时清理发给资源上传者的通知', async () => {
    findUniqueMock.mockResolvedValue({
      ...baseComment,
      resource_id: 5,
      resource: { user_id: 3 }
    })

    const result = await deleteComment({ commentId: 11 }, 7, 1)

    expect(result).toEqual({})
    expect(messageDeleteManyMock).toHaveBeenCalledWith({
      where: {
        type: 'comment',
        sender_id: 7,
        recipient_id: 3,
        link: '/patch-10/resource/5?commentId=11'
      }
    })
  })

  it('资源评论的回复删除时按资源页深链清理父评论作者的通知', async () => {
    findUniqueMock.mockResolvedValue({
      ...baseComment,
      parent_id: 6,
      parent: { user_id: 9 },
      resource_id: 42,
      resource: { user_id: 3 }
    })

    await deleteComment({ commentId: 11 }, 7, 1)

    expect(messageDeleteManyMock).toHaveBeenCalledTimes(1)
    expect(messageDeleteManyMock).toHaveBeenCalledWith({
      where: {
        type: 'comment',
        sender_id: 7,
        recipient_id: 9,
        link: '/patch-10/resource/42?commentId=11'
      }
    })
  })

  it('普通评论的回复删除仍按游戏页深链清理 (回归)', async () => {
    findUniqueMock.mockResolvedValue({
      ...baseComment,
      parent_id: 6,
      parent: { user_id: 9 }
    })

    await deleteComment({ commentId: 11 }, 7, 1)

    expect(messageDeleteManyMock).toHaveBeenCalledWith({
      where: {
        type: 'comment',
        sender_id: 7,
        recipient_id: 9,
        link: '/patch-10?tab=comments&commentId=11'
      }
    })
  })

  it('顶层普通评论删除不做通知清理', async () => {
    findUniqueMock.mockResolvedValue(baseComment)

    await deleteComment({ commentId: 11 }, 7, 1)

    expect(messageDeleteManyMock).not.toHaveBeenCalled()
  })
})
