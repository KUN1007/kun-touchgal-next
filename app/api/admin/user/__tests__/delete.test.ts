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
  invalidateCommentCacheMock,
  findResourcesInTransactionMock,
  recalcPatchTypeMock,
  queueSearchSyncMock
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
  invalidateCommentCacheMock: vi.fn(),
  findResourcesInTransactionMock: vi.fn(),
  recalcPatchTypeMock: vi.fn(),
  queueSearchSyncMock: vi.fn()
}))

const events: string[] = []
const transactionClient = {
  $executeRaw: executeRawMock,
  $queryRaw: queryRawMock,
  patch_rating: { findMany: findRatingsInTransactionMock },
  patch_resource: { findMany: findResourcesInTransactionMock },
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

vi.mock('~/app/api/patch/resource/_helper', () => ({
  recalcPatchType: recalcPatchTypeMock
}))

vi.mock('~/server/search/sync', () => ({
  queueSearchSync: queueSearchSyncMock
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
  findResourcesInTransactionMock.mockResolvedValue([])
  recalcPatchTypeMock.mockImplementation(async (patchId: number) => {
    events.push(`recalc-${patchId}`)
  })
  queueSearchSyncMock.mockImplementation((patchId: number) => {
    events.push(`sync-${patchId}`)
  })
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

  it('recomputes and re-syncs surviving patches whose non-s3 resources cascade away', async () => {
    // 他人 (user_id !== 7) 补丁下、无 S3 link 的资源: 只随 user.delete() 级联消失,
    // S3 收集看不到它们. 返回乱序以验证按 patch_id 排序取通告锁 (确定性锁序)
    findResourcesInTransactionMock.mockResolvedValue([
      { patch_id: 32 },
      { patch_id: 30 }
    ])

    await expect(deleteUser({ uid: 7 }, 99)).resolves.toEqual({})

    expect(findResourcesInTransactionMock).toHaveBeenCalledWith({
      where: { user_id: 7, patch: { user_id: { not: 7 } } },
      select: { patch_id: true },
      distinct: ['patch_id']
    })
    // 事务内、级联删除后按升序重算, 每次都用事务客户端持通告锁
    expect(recalcPatchTypeMock.mock.calls).toEqual([
      [30, transactionClient],
      [32, transactionClient]
    ])
    // 事务提交后再入搜索同步队列
    expect(queueSearchSyncMock.mock.calls).toEqual([[30], [32]])
    expect(events).toEqual([
      'transaction-start',
      'delete-user',
      'recompute-many',
      'recalc-30',
      'recalc-32',
      'transaction-end',
      'invalidate-tag-cache',
      'invalidate-company-cache',
      'delete-token',
      'invalidate-cache',
      'invalidate-comment-cache',
      'sync-30',
      'sync-32'
    ])
  })
  it('retries serializable conflicts without repeating resource cleanup', async () => {
    findResourcesMock.mockResolvedValue([{ id: 55 }])
    // 首次尝试(将因冲突回滚)与重试各收集到不同的受影响 patch
    findResourcesInTransactionMock
      .mockResolvedValueOnce([{ patch_id: 91 }])
      .mockResolvedValueOnce([{ patch_id: 92 }])
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
    // recalcPatchType 事务内两次尝试各跑一次; 事务后搜索同步只用最后一次成功
    // 事务的 affectedPatchIds, 不泄漏被回滚的首次尝试收集的 patch
    expect(recalcPatchTypeMock.mock.calls).toEqual([
      [91, transactionClient],
      [92, transactionClient]
    ])
    expect(queueSearchSyncMock.mock.calls).toEqual([[92]])
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
