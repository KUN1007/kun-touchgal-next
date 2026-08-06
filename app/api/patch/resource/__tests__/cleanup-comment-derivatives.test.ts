import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  deletePendingModerationTasksMock,
  deletePendingAppealsMock,
  collectPendingReportIdsMock
} = vi.hoisted(() => ({
  deletePendingModerationTasksMock: vi.fn(),
  deletePendingAppealsMock: vi.fn(),
  collectPendingReportIdsMock: vi.fn()
}))

vi.mock('~/prisma/index', () => ({
  prisma: {}
}))

vi.mock('~/app/api/patch/cache', () => ({
  invalidatePatchContentCache: vi.fn()
}))

vi.mock('~/lib/redis', () => ({
  acquireKvLock: vi.fn(),
  delKv: vi.fn(),
  getKv: vi.fn(),
  releaseKvLock: vi.fn()
}))

vi.mock('~/lib/s3', () => ({
  copyObject: vi.fn(),
  deleteFileFromS3: vi.fn(),
  headObject: vi.fn()
}))

vi.mock('~/server/storage/s3Outbox', () => ({
  enqueueS3Deletion: vi.fn()
}))

vi.mock('~/server/moderation/submit', () => ({
  deletePendingModerationTasks: deletePendingModerationTasksMock
}))

vi.mock('~/server/moderation/appeal', () => ({
  deletePendingAppeals: deletePendingAppealsMock
}))

vi.mock('~/server/report/pending', () => ({
  collectPendingReportIds: collectPendingReportIdsMock
}))

vi.mock('~/app/api/user/session/cache', () => ({
  invalidateUserSession: vi.fn()
}))

import { cleanupResourceCommentDerivatives } from '~/app/api/patch/resource/_helper'

const makeTx = (
  resource: { patch: { unique_id: string }; comment: { id: number }[] } | null
) => ({
  patch_resource: {
    findUnique: vi.fn().mockResolvedValue(resource)
  },
  user_message: {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 })
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('cleanupResourceCommentDerivatives', () => {
  it('资源有评论时清理站内信 (link 前缀) 与待裁决审核任务/申诉, 并返回收集的 pending 举报主键', async () => {
    const tx = makeTx({
      patch: { unique_id: 'patch-10' },
      comment: [{ id: 11 }, { id: 12 }]
    })
    collectPendingReportIdsMock.mockResolvedValue([21, 22])

    const reportIds = await cleanupResourceCommentDerivatives(tx as any, 5)

    expect(tx.user_message.deleteMany).toHaveBeenCalledWith({
      where: {
        link: { startsWith: '/patch-10/resource/5?commentId=' }
      }
    })
    expect(deletePendingModerationTasksMock).toHaveBeenCalledWith(
      'comment',
      [11, 12],
      tx
    )
    expect(deletePendingAppealsMock).toHaveBeenCalledWith(
      'comment',
      [11, 12],
      tx
    )
    // 举报只收集不删除: 删除须由调用方在资源行删除后执行
    expect(collectPendingReportIdsMock).toHaveBeenCalledWith(
      'comment',
      [11, 12],
      tx
    )
    expect(reportIds).toEqual([21, 22])
  })

  it('资源无评论时不做任何清理', async () => {
    const tx = makeTx({ patch: { unique_id: 'patch-10' }, comment: [] })

    const reportIds = await cleanupResourceCommentDerivatives(tx as any, 5)

    expect(tx.user_message.deleteMany).not.toHaveBeenCalled()
    expect(deletePendingModerationTasksMock).not.toHaveBeenCalled()
    expect(deletePendingAppealsMock).not.toHaveBeenCalled()
    expect(collectPendingReportIdsMock).not.toHaveBeenCalled()
    expect(reportIds).toEqual([])
  })

  it('资源不存在时静默返回', async () => {
    const tx = makeTx(null)

    const reportIds = await cleanupResourceCommentDerivatives(tx as any, 5)

    expect(tx.user_message.deleteMany).not.toHaveBeenCalled()
    expect(reportIds).toEqual([])
  })
})
