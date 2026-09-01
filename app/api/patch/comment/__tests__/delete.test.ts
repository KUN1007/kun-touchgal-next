import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  findUniqueMock,
  transactionMock,
  queryRawMock,
  subtreeFindManyMock,
  deleteMock,
  messageDeleteManyMock,
  deletePendingModerationTasksMock,
  deletePendingAppealsMock,
  deleteOrphanReportsMock,
  invalidateCommentCacheMock,
  invalidateContentMock
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  queryRawMock: vi.fn(),
  subtreeFindManyMock: vi.fn(),
  deleteMock: vi.fn(),
  messageDeleteManyMock: vi.fn(),
  deletePendingModerationTasksMock: vi.fn(),
  deletePendingAppealsMock: vi.fn(),
  deleteOrphanReportsMock: vi.fn(),
  invalidateCommentCacheMock: vi.fn(async () => undefined),
  invalidateContentMock: vi.fn(async () => undefined)
}))

const transactionClient = {
  $queryRaw: queryRawMock,
  patch_comment: { findMany: subtreeFindManyMock, delete: deleteMock },
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
  deleteOrphanReports: deleteOrphanReportsMock
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
  resource_id: null,
  patch_id: 10,
  status: 0,
  patch: { unique_id: 'patch-10' }
}

const rootRow = {
  id: 11,
  parent_id: null,
  resource_id: null,
  parent: null,
  resource: null
}

beforeEach(() => {
  vi.clearAllMocks()
  queryRawMock.mockResolvedValue([{ id: 11 }])
  subtreeFindManyMock.mockResolvedValue([rootRow])
  deleteMock.mockResolvedValue({})
  messageDeleteManyMock.mockResolvedValue({ count: 1 })
  deleteOrphanReportsMock.mockResolvedValue(undefined)
  transactionMock.mockImplementation(
    async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient)
  )
})

describe('deleteComment 通知批量清理', () => {
  it('资源评论子树按资源页深链批量清理, recipient 为上传者+父作者', async () => {
    findUniqueMock.mockResolvedValue({ ...baseComment, resource_id: 5 })
    queryRawMock.mockResolvedValue([{ id: 11 }, { id: 12 }])
    subtreeFindManyMock.mockResolvedValue([
      { ...rootRow, resource_id: 5, resource: { user_id: 3 } },
      {
        id: 12,
        parent_id: 11,
        resource_id: 5,
        parent: { user_id: 7 },
        resource: { user_id: 3 }
      }
    ])

    const result = await deleteComment({ commentId: 11 }, 7, 1)

    expect(result).toEqual({})
    expect(messageDeleteManyMock).toHaveBeenCalledTimes(1)
    expect(messageDeleteManyMock).toHaveBeenCalledWith({
      where: {
        type: 'comment',
        recipient_id: { in: [3, 7] },
        link: {
          in: [
            '/patch-10/resource/5?commentId=11',
            '/patch-10/resource/5?commentId=12'
          ]
        }
      }
    })
  })

  it('普通评论子树按游戏页深链批量清理 (回归)', async () => {
    findUniqueMock.mockResolvedValue(baseComment)
    queryRawMock.mockResolvedValue([{ id: 11 }, { id: 12 }])
    subtreeFindManyMock.mockResolvedValue([
      rootRow,
      {
        id: 12,
        parent_id: 11,
        resource_id: null,
        parent: { user_id: 9 },
        resource: null
      }
    ])

    await deleteComment({ commentId: 11 }, 7, 1)

    expect(messageDeleteManyMock).toHaveBeenCalledWith({
      where: {
        type: 'comment',
        recipient_id: { in: [9] },
        link: {
          in: [
            '/patch-10?tab=comments&commentId=11',
            '/patch-10?tab=comments&commentId=12'
          ]
        }
      }
    })
  })

  it('混合 resource_id 存量子树按行构造 link, 非根资源行不加上传者', async () => {
    findUniqueMock.mockResolvedValue(baseComment)
    queryRawMock.mockResolvedValue([{ id: 11 }, { id: 12 }])
    subtreeFindManyMock.mockResolvedValue([
      rootRow,
      {
        id: 12,
        parent_id: 11,
        resource_id: 42,
        parent: { user_id: 9 },
        resource: { user_id: 3 }
      }
    ])

    await deleteComment({ commentId: 11 }, 7, 1)

    expect(messageDeleteManyMock).toHaveBeenCalledWith({
      where: {
        type: 'comment',
        recipient_id: { in: [9] },
        link: {
          in: [
            '/patch-10?tab=comments&commentId=11',
            '/patch-10/resource/42?commentId=12'
          ]
        }
      }
    })
  })

  it('无回复的顶层普通评论不做通知清理', async () => {
    findUniqueMock.mockResolvedValue(baseComment)

    await deleteComment({ commentId: 11 }, 7, 1)

    expect(messageDeleteManyMock).not.toHaveBeenCalled()
  })
})

describe('deleteComment 级联删除', () => {
  it('只对根执行一次 delete, 子树行按收集到的 id 一次取回', async () => {
    findUniqueMock.mockResolvedValue(baseComment)
    queryRawMock.mockResolvedValue([{ id: 11 }, { id: 12 }, { id: 13 }])
    subtreeFindManyMock.mockResolvedValue([
      rootRow,
      {
        id: 12,
        parent_id: 11,
        resource_id: null,
        parent: { user_id: 7 },
        resource: null
      },
      {
        id: 13,
        parent_id: 12,
        resource_id: null,
        parent: { user_id: 9 },
        resource: null
      }
    ])

    await deleteComment({ commentId: 11 }, 7, 1)

    expect(subtreeFindManyMock).toHaveBeenCalledTimes(1)
    expect(subtreeFindManyMock).toHaveBeenCalledWith({
      where: { id: { in: [11, 12, 13] } },
      select: {
        id: true,
        parent_id: true,
        resource_id: true,
        parent: { select: { user_id: true } },
        resource: { select: { user_id: true } }
      }
    })
    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: 11 } })
    expect(deletePendingModerationTasksMock).toHaveBeenCalledWith(
      'comment',
      [11, 12, 13],
      transactionClient
    )
    expect(deletePendingAppealsMock).toHaveBeenCalledWith(
      'comment',
      [11, 12, 13],
      transactionClient
    )
  })
})

describe('deleteComment 举报清理', () => {
  it('删除后按 NULL 目标清理级联置空的孤儿举报', async () => {
    findUniqueMock.mockResolvedValue(baseComment)

    await deleteComment({ commentId: 11 }, 7, 1)

    expect(deleteOrphanReportsMock).toHaveBeenCalledWith(
      'comment',
      transactionClient
    )
    expect(deleteMock.mock.invocationCallOrder[0]).toBeLessThan(
      deleteOrphanReportsMock.mock.invocationCallOrder[0]
    )
  })
})
