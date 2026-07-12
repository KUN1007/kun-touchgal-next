import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  findUserMock,
  findResourcesMock,
  countResourcesMock,
  findRatingsMock,
  findRatingsInTransactionMock,
  transactionMock,
  executeRawMock,
  isConflictMock,
  queryRawMock,
  deleteUserMock,
  createLogMock,
  deleteResourceMock,
  recomputeManyMock,
  recomputeOneMock,
  deleteTokenMock,
  invalidateCacheMock,
  invalidateTagCacheMock,
  invalidateCompanyCacheMock,
  findCommentedPatchesMock,
  invalidateCommentCacheMock
} = vi.hoisted(() => ({
  findUserMock: vi.fn(),
  findResourcesMock: vi.fn(),
  countResourcesMock: vi.fn(),
  findRatingsMock: vi.fn(),
  findRatingsInTransactionMock: vi.fn(),
  transactionMock: vi.fn(),
  executeRawMock: vi.fn(),
  isConflictMock: vi.fn(),
  queryRawMock: vi.fn(),
  deleteUserMock: vi.fn(),
  createLogMock: vi.fn(),
  deleteResourceMock: vi.fn(),
  recomputeManyMock: vi.fn(),
  recomputeOneMock: vi.fn(),
  deleteTokenMock: vi.fn(),
  invalidateCacheMock: vi.fn(),
  invalidateTagCacheMock: vi.fn(),
  invalidateCompanyCacheMock: vi.fn(),
  findCommentedPatchesMock: vi.fn(),
  invalidateCommentCacheMock: vi.fn()
}))

const events: string[] = []
const transactionClient = {
  $executeRaw: executeRawMock,
  $queryRaw: queryRawMock,
  patch_rating: { findMany: findRatingsInTransactionMock },
  user: { delete: deleteUserMock },
  admin_log: { create: createLogMock }
}

vi.mock('~/prisma/index', () => ({
  isPrismaTransactionConflict: isConflictMock,
  prisma: {
    user: { findUnique: findUserMock },
    patch_resource: {
      findMany: findResourcesMock,
      count: countResourcesMock
    },
    patch_rating: { findMany: findRatingsMock },
    patch_comment: { findMany: findCommentedPatchesMock },
    $transaction: transactionMock
  }
}))

vi.mock('~/app/api/utils/jwt', () => ({
  deleteKunToken: deleteTokenMock
}))

vi.mock('~/app/api/admin/resource/delete', () => ({
  deleteResource: deleteResourceMock
}))

vi.mock('~/app/api/resource/cache', () => ({
  invalidateResourceListCache: invalidateCacheMock
}))

vi.mock('~/app/api/tag/cache', () => ({
  invalidateTagListCache: invalidateTagCacheMock
}))

vi.mock('~/app/api/company/cache', () => ({
  invalidateCompanyListCache: invalidateCompanyCacheMock
}))

vi.mock('~/app/api/patch/comment/cache', () => ({
  invalidatePatchCommentCache: invalidateCommentCacheMock
}))

vi.mock('~/app/api/patch/rating/stat', () => ({
  recomputePatchRatingStats: recomputeManyMock,
  recomputePatchRatingStat: recomputeOneMock
}))

import { deleteUser } from '~/app/api/admin/user/delete'

beforeEach(() => {
  vi.clearAllMocks()
  isConflictMock.mockReturnValue(true)
  events.length = 0
  findUserMock
    .mockResolvedValueOnce({
      id: 7,
      name: 'target',
      email: 'target@example.com',
      role: 1,
      status: 0
    })
    .mockResolvedValueOnce({ id: 99, name: 'admin' })
  findResourcesMock.mockResolvedValue([])
  countResourcesMock.mockResolvedValue(1)
  findRatingsMock.mockResolvedValue([
    { patch_id: 10 },
    { patch_id: 11 },
    { patch_id: 12 }
  ])
  findRatingsInTransactionMock.mockResolvedValue([
    { patch_id: 10, status: 0, patch: { user_id: 100 } },
    { patch_id: 11, status: 0, patch: { user_id: 7 } },
    { patch_id: 12, status: 2, patch: { user_id: 100 } }
  ])
  executeRawMock.mockResolvedValue(1)
  queryRawMock.mockResolvedValue([
    { id: 1, patch_id: 10, status: 0, patch_user_id: 100 },
    { id: 2, patch_id: 11, status: 0, patch_user_id: 7 },
    { id: 3, patch_id: 12, status: 2, patch_user_id: 100 }
  ])
  deleteUserMock.mockImplementation(async () => {
    events.push('delete-user')
    return {}
  })
  createLogMock.mockResolvedValue({})
  deleteResourceMock.mockResolvedValue({})
  recomputeManyMock.mockImplementation(async () => {
    events.push('recompute-many')
  })
  recomputeOneMock.mockImplementation(async () => {
    events.push('recompute-one')
  })
  deleteTokenMock.mockImplementation(async () => {
    events.push('delete-token')
  })
  invalidateCacheMock.mockImplementation(async () => {
    events.push('invalidate-cache')
  })
  invalidateTagCacheMock.mockImplementation(async () => {
    events.push('invalidate-tag-cache')
  })
  invalidateCompanyCacheMock.mockImplementation(async () => {
    events.push('invalidate-company-cache')
  })
  findCommentedPatchesMock.mockResolvedValue([{ patch_id: 20 }])
  invalidateCommentCacheMock.mockImplementation(async () => {
    events.push('invalidate-comment-cache')
  })
  transactionMock.mockImplementation(
    async (callback: (tx: typeof transactionClient) => Promise<unknown>) => {
      events.push('transaction-start')
      const result = await callback(transactionClient)
      events.push('transaction-end')
      return result
    }
  )
})

describe('deleteUser', () => {
  it('uses a serializable snapshot before atomically recomputing surviving visible patches', async () => {
    await expect(deleteUser({ uid: 7 }, 99)).resolves.toEqual({})

    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 60000,
      isolationLevel: 'Serializable'
    })
    expect(executeRawMock).not.toHaveBeenCalled()
    expect(queryRawMock).not.toHaveBeenCalled()
    expect(findRatingsMock).not.toHaveBeenCalled()
    expect(findRatingsInTransactionMock).toHaveBeenCalledWith({
      where: { user_id: 7 },
      select: {
        patch_id: true,
        status: true,
        patch: { select: { user_id: true } }
      }
    })

    expect(recomputeManyMock).toHaveBeenCalledWith([10], transactionClient)
    expect(recomputeOneMock).not.toHaveBeenCalled()
    expect(events).toEqual([
      'transaction-start',
      'delete-user',
      'recompute-many',
      'transaction-end',
      'invalidate-tag-cache',
      'invalidate-company-cache',
      'delete-token',
      'invalidate-cache',
      'invalidate-comment-cache'
    ])
  })
  it('retries serializable conflicts without repeating resource cleanup', async () => {
    findResourcesMock.mockResolvedValue([{ id: 55 }])
    let attempt = 0
    transactionMock.mockImplementation(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) => {
        const result = await callback(transactionClient)
        attempt++
        if (attempt === 1) {
          throw Object.assign(new Error('write conflict'), { code: 'P2034' })
        }
        return result
      }
    )

    await expect(deleteUser({ uid: 7 }, 99)).resolves.toEqual({})

    expect(deleteResourceMock).toHaveBeenCalledTimes(1)
    expect(transactionMock).toHaveBeenCalledTimes(2)
    expect(deleteUserMock).toHaveBeenCalledTimes(2)
    expect(deleteTokenMock).toHaveBeenCalledTimes(1)
  })

  it('invalidates cascading lists before token cleanup can fail', async () => {
    deleteTokenMock.mockImplementation(async () => {
      events.push('delete-token')
      throw new Error('redis down')
    })

    await expect(deleteUser({ uid: 7 }, 99)).rejects.toThrow('redis down')

    expect(invalidateTagCacheMock).toHaveBeenCalledTimes(1)
    expect(invalidateCompanyCacheMock).toHaveBeenCalledTimes(1)
    expect(invalidateCacheMock).not.toHaveBeenCalled()
    expect(events.slice(-3)).toEqual([
      'invalidate-tag-cache',
      'invalidate-company-cache',
      'delete-token'
    ])
  })

  it('does not invalidate list caches when the transaction fails', async () => {
    isConflictMock.mockReturnValue(false)
    transactionMock.mockRejectedValue(new Error('database down'))

    await expect(deleteUser({ uid: 7 }, 99)).rejects.toThrow('database down')

    expect(invalidateCacheMock).not.toHaveBeenCalled()
    expect(invalidateTagCacheMock).not.toHaveBeenCalled()
    expect(invalidateCompanyCacheMock).not.toHaveBeenCalled()
  })
})
