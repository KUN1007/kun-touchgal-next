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

type TxResource = {
  id: number
  patch: { unique_id: string }
  comment: { id: number }[]
}

// findMany 带 comment: { some: {} } 过滤, 无评论 / 不存在的资源不会出现在结果里
const makeTx = (resources: TxResource[]) => ({
  patch_resource: {
    findMany: vi.fn().mockResolvedValue(resources)
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
    const tx = makeTx([
      {
        id: 5,
        patch: { unique_id: 'patch-10' },
        comment: [{ id: 11 }, { id: 12 }]
      }
    ])

    await cleanupResourceCommentDerivatives(tx as any, 5)

    expect(tx.patch_resource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [5] }, comment: { some: {} } }
      })
    )
    expect(tx.user_message.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ link: { startsWith: '/patch-10/resource/5?commentId=' } }]
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

  it('批量: 一次查询 + 一条 OR 删除合并全部资源的评论派生', async () => {
    const tx = makeTx([
      { id: 5, patch: { unique_id: 'patch-10' }, comment: [{ id: 11 }] },
      { id: 8, patch: { unique_id: 'patch-20' }, comment: [{ id: 21 }] }
    ])

    await cleanupResourceCommentDerivatives(tx as any, [5, 6, 8])

    expect(tx.patch_resource.findMany).toHaveBeenCalledTimes(1)
    expect(tx.patch_resource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [5, 6, 8] }, comment: { some: {} } }
      })
    )
    expect(tx.user_message.deleteMany).toHaveBeenCalledTimes(1)
    expect(tx.user_message.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { link: { startsWith: '/patch-10/resource/5?commentId=' } },
          { link: { startsWith: '/patch-20/resource/8?commentId=' } }
        ]
      }
    })
    expect(deletePendingModerationTasksMock).toHaveBeenCalledWith(
      'comment',
      [11, 21],
      tx
    )
    expect(deletePendingAppealsMock).toHaveBeenCalledWith(
      'comment',
      [11, 21],
      tx
    )
  })

  it('资源无评论或不存在时不做任何清理', async () => {
    const tx = makeTx([])

    await cleanupResourceCommentDerivatives(tx as any, 5)

    expect(tx.user_message.deleteMany).not.toHaveBeenCalled()
    expect(deletePendingModerationTasksMock).not.toHaveBeenCalled()
    expect(deletePendingAppealsMock).not.toHaveBeenCalled()
  })
})
