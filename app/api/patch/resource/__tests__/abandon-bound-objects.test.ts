import { beforeEach, describe, expect, it, vi } from 'vitest'

const { enqueueS3DeletionMock, kickS3DeletionDrainMock, prismaMock } =
  vi.hoisted(() => ({
    enqueueS3DeletionMock: vi.fn(),
    kickS3DeletionDrainMock: vi.fn(),
    prismaMock: {}
  }))

vi.mock('~/lib/s3', () => ({
  copyObject: vi.fn(),
  deleteFileFromS3: vi.fn(),
  headObject: vi.fn()
}))

vi.mock('~/lib/redis', () => ({
  acquireKvLock: vi.fn(),
  delKv: vi.fn(),
  getKv: vi.fn(),
  releaseKvLock: vi.fn()
}))

vi.mock('~/prisma/index', () => ({ prisma: prismaMock }))

vi.mock('~/server/storage/s3Outbox', () => ({
  enqueueS3Deletion: enqueueS3DeletionMock,
  kickS3DeletionDrain: kickS3DeletionDrainMock
}))

vi.mock('~/server/moderation/submit', () => ({
  deletePendingModerationTasks: vi.fn()
}))

vi.mock('~/server/moderation/appeal', () => ({
  deletePendingAppeals: vi.fn()
}))

vi.mock('~/app/api/patch/cache', () => ({
  invalidatePatchContentCache: vi.fn()
}))

vi.mock('~/app/api/user/session/cache', () => ({
  invalidateUserSession: vi.fn()
}))

import { abandonBoundResourceObjects } from '~/app/api/patch/resource/_helper'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('abandonBoundResourceObjects', () => {
  it('空集合不入队不踢 drain', async () => {
    await abandonBoundResourceObjects([], 10)

    expect(enqueueS3DeletionMock).not.toHaveBeenCalled()
    expect(kickS3DeletionDrainMock).not.toHaveBeenCalled()
  })

  it('非空集合按 s3Key 入删除出箱并即时踢 drain', async () => {
    enqueueS3DeletionMock.mockResolvedValue(undefined)

    await abandonBoundResourceObjects(
      [
        { content: 'c-a', s3Key: 'k-a' },
        { content: 'c-b', s3Key: 'k-b' }
      ],
      10
    )

    expect(enqueueS3DeletionMock).toHaveBeenCalledWith(prismaMock, [
      'k-a',
      'k-b'
    ])
    expect(kickS3DeletionDrainMock).toHaveBeenCalledTimes(1)
  })

  it('入队失败自吞不抛, 不遮蔽调用方正在返回的业务错误', async () => {
    enqueueS3DeletionMock.mockRejectedValue(new Error('db down'))

    await expect(
      abandonBoundResourceObjects([{ content: 'c-a', s3Key: 'k-a' }], 10)
    ).resolves.toBeUndefined()
    expect(kickS3DeletionDrainMock).not.toHaveBeenCalled()
  })
})
