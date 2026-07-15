import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  findPatchMock,
  findResourcesMock,
  transactionMock,
  findCommentsMock,
  findRatingsMock,
  resourceDeleteMock,
  patchDeleteMock,
  deleteTasksMock,
  deleteAppealsMock,
  deleteLinkMock,
  invalidateCacheMock,
  queueSearchRemoveMock
} = vi.hoisted(() => ({
  findPatchMock: vi.fn(),
  findResourcesMock: vi.fn(),
  transactionMock: vi.fn(),
  findCommentsMock: vi.fn(),
  findRatingsMock: vi.fn(),
  resourceDeleteMock: vi.fn(),
  patchDeleteMock: vi.fn(),
  deleteTasksMock: vi.fn(),
  deleteAppealsMock: vi.fn(),
  deleteLinkMock: vi.fn(),
  invalidateCacheMock: vi.fn(),
  queueSearchRemoveMock: vi.fn()
}))

const transactionClient = {
  patch_comment: { findMany: findCommentsMock },
  patch_rating: { findMany: findRatingsMock },
  patch_resource: { delete: resourceDeleteMock },
  patch: { delete: patchDeleteMock }
}

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch: { findUnique: findPatchMock },
    patch_resource: { findMany: findResourcesMock },
    $transaction: transactionMock
  }
}))

vi.mock('~/app/api/patch/resource/_helper', () => ({
  deletePatchResourceLink: deleteLinkMock
}))

vi.mock('~/app/api/resource/cache', () => ({
  invalidateResourceListCache: invalidateCacheMock
}))

vi.mock('~/server/moderation/submit', () => ({
  deletePendingModerationTasks: deleteTasksMock
}))

vi.mock('~/server/moderation/appeal', () => ({
  deletePendingAppeals: deleteAppealsMock
}))

vi.mock('~/server/search/sync', () => ({
  queueSearchRemove: queueSearchRemoveMock,
  enqueueSearchOutbox: vi.fn()
}))

import { deletePatchById } from '~/app/api/patch/delete'

const resource = (id: number, status: number, section: string) => ({
  id,
  patch_id: 7,
  status,
  section,
  links: [
    {
      storage: 's3',
      content: `content-${id}`,
      hash: `hash-${id}`,
      s3_key: `key-${id}`
    },
    {
      storage: 'user',
      content: `user-content-${id}`,
      hash: '',
      s3_key: ''
    }
  ]
})

beforeEach(() => {
  vi.clearAllMocks()
  findPatchMock.mockResolvedValue({ id: 7 })
  findResourcesMock.mockResolvedValue([
    resource(1, 0, 'patch'),
    resource(2, 1, 'game')
  ])
  findCommentsMock.mockResolvedValue([{ id: 11 }])
  findRatingsMock.mockResolvedValue([{ id: 21 }])
  patchDeleteMock.mockResolvedValue({})
  deleteTasksMock.mockResolvedValue(undefined)
  deleteAppealsMock.mockResolvedValue(undefined)
  deleteLinkMock.mockResolvedValue(undefined)
  invalidateCacheMock.mockResolvedValue(undefined)
  transactionMock.mockImplementation(
    async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient)
  )
})

describe('deletePatchById', () => {
  it('relies on patch cascade instead of per-resource deletes while keeping cleanup inputs', async () => {
    await expect(deletePatchById({ patchId: 7 })).resolves.toEqual({})

    expect(resourceDeleteMock).not.toHaveBeenCalled()
    expect(patchDeleteMock).toHaveBeenCalledTimes(1)
    expect(patchDeleteMock).toHaveBeenCalledWith({ where: { id: 7 } })

    expect(deleteTasksMock).toHaveBeenCalledWith(
      'resource',
      [1, 2],
      transactionClient
    )
    expect(deleteAppealsMock).toHaveBeenCalledWith(
      'resource',
      [1, 2],
      transactionClient
    )

    expect(deleteLinkMock).toHaveBeenCalledTimes(2)
    expect(deleteLinkMock).toHaveBeenCalledWith(
      'content-1',
      7,
      'hash-1',
      'key-1'
    )
    expect(deleteLinkMock).toHaveBeenCalledWith(
      'content-2',
      7,
      'hash-2',
      'key-2'
    )

    expect(invalidateCacheMock).toHaveBeenCalledTimes(1)
    expect(queueSearchRemoveMock).toHaveBeenCalledWith(7)
  })

  it('skips resource list cache invalidation when no visible patch resource exists', async () => {
    findResourcesMock.mockResolvedValue([
      resource(1, 1, 'patch'),
      resource(2, 0, 'game')
    ])

    await expect(deletePatchById({ patchId: 7 })).resolves.toEqual({})

    expect(invalidateCacheMock).not.toHaveBeenCalled()
  })

  it('returns an error message when the patch does not exist', async () => {
    findPatchMock.mockResolvedValue(null)

    await expect(deletePatchById({ patchId: 7 })).resolves.toBe('未找到该游戏')
    expect(transactionMock).not.toHaveBeenCalled()
  })
})
