import { beforeEach, describe, expect, it, vi } from 'vitest'

const { deletePendingModerationTasksMock, deletePendingAppealsMock } =
  vi.hoisted(() => ({
    deletePendingModerationTasksMock: vi.fn(),
    deletePendingAppealsMock: vi.fn()
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
  it('资源有评论时清理站内信 (link 前缀) 与待裁决审核任务/申诉', async () => {
    const tx = makeTx({
      patch: { unique_id: 'patch-10' },
      comment: [{ id: 11 }, { id: 12 }]
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await cleanupResourceCommentDerivatives(tx as any, 5)

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
  })

  it('资源无评论时不做任何清理', async () => {
    const tx = makeTx({ patch: { unique_id: 'patch-10' }, comment: [] })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await cleanupResourceCommentDerivatives(tx as any, 5)

    expect(tx.user_message.deleteMany).not.toHaveBeenCalled()
    expect(deletePendingModerationTasksMock).not.toHaveBeenCalled()
    expect(deletePendingAppealsMock).not.toHaveBeenCalled()
  })

  it('资源不存在时静默返回', async () => {
    const tx = makeTx(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await cleanupResourceCommentDerivatives(tx as any, 5)

    expect(tx.user_message.deleteMany).not.toHaveBeenCalled()
  })
})
