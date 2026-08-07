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
  invalidateResourceDetailMock,
  findResourcesInTransactionMock,
  recalcPatchTypeMock,
  enqueueSearchOutboxMock,
  kickDrainMock,
  invalidatePatchContentCacheMock,
  invalidateContentByPatchIdMock,
  deleteOrphanReportsMock
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
  invalidateResourceDetailMock: vi.fn(),
  findResourcesInTransactionMock: vi.fn(),
  recalcPatchTypeMock: vi.fn(),
  enqueueSearchOutboxMock: vi.fn(),
  kickDrainMock: vi.fn(),
  invalidatePatchContentCacheMock: vi.fn(),
  invalidateContentByPatchIdMock: vi.fn(),
  deleteOrphanReportsMock: vi.fn()
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

vi.mock('~/app/api/patch/resource/cache', () => ({
  invalidatePatchResourceDetailCache: invalidateResourceDetailMock
}))

vi.mock('~/app/api/patch/rating/stat', () => ({
  recomputePatchRatingStats: recomputeManyMock,
  recomputePatchRatingStat: recomputeOneMock
}))

vi.mock('~/app/api/patch/resource/_helper', () => ({
  recalcPatchType: recalcPatchTypeMock
}))

vi.mock('~/app/api/patch/cache', () => ({
  invalidatePatchContentCache: invalidatePatchContentCacheMock,
  invalidatePatchContentCacheByPatchId: invalidateContentByPatchIdMock
}))

vi.mock('~/server/search/sync', () => ({
  enqueueSearchOutbox: enqueueSearchOutboxMock,
  kickSearchOutboxDrain: kickDrainMock
}))

vi.mock('~/server/report/pending', () => ({
  deleteOrphanReports: deleteOrphanReportsMock
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
    return `uid-${patchId}`
  })
  enqueueSearchOutboxMock.mockImplementation(
    async (_client: unknown, patchId: number) => {
      events.push(`enqueue-${patchId}`)
    }
  )
  kickDrainMock.mockImplementation(() => {
    events.push('kick-drain')
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
  deleteOrphanReportsMock.mockImplementation(async () => {
    events.push('delete-orphan-reports')
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
  invalidatePatchContentCacheMock.mockResolvedValue(undefined)
  invalidateContentByPatchIdMock.mockResolvedValue(undefined)
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
    // 孤儿举报清理在事务内、级联删除之后 (删除前清理与级联 SET NULL 锁序相反会死锁)
    expect(deleteOrphanReportsMock).toHaveBeenCalledWith(
      'comment',
      transactionClient
    )
    expect(events).toEqual([
      'transaction-start',
      'delete-user',
      'delete-orphan-reports',
      'recompute-many',
      'transaction-end',
      'invalidate-tag-cache',
      'invalidate-company-cache',
      'delete-token',
      'invalidate-cache',
      'invalidate-comment-cache',
      'kick-drain'
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
    // 事务内逐 id 入队（与重算同循环、同事务，原子提交）
    expect(enqueueSearchOutboxMock.mock.calls).toEqual([
      [transactionClient, 30],
      [transactionClient, 32]
    ])
    // M-04: 事务提交后按 unique_id 失效 patch 内容缓存 (提交前失效会被并发读回填旧值)
    expect(invalidatePatchContentCacheMock.mock.calls).toEqual([
      ['uid-30'],
      ['uid-32']
    ])
    // 事务提交后仅一次 kick 触发 drain 处理整箱（不再逐 id 各 kick）
    expect(kickDrainMock).toHaveBeenCalledTimes(1)
    expect(events).toEqual([
      'transaction-start',
      'delete-user',
      'delete-orphan-reports',
      'recompute-many',
      'recalc-30',
      'enqueue-30',
      'recalc-32',
      'enqueue-32',
      'transaction-end',
      'invalidate-tag-cache',
      'invalidate-company-cache',
      'delete-token',
      'invalidate-cache',
      'invalidate-comment-cache',
      'kick-drain'
    ])
  })

  it('失效级联删除的评论与评分所在 patch 的详情缓存 (M-05)', async () => {
    findCommentedPatchesMock.mockResolvedValue([
      { patch_id: 40 },
      { patch_id: 41 }
    ])
    findRatingsInTransactionMock.mockResolvedValue([
      { patch_id: 50, status: 0, patch: { user_id: 8 } },
      { patch_id: 51, status: 2, patch: { user_id: 8 } },
      { patch_id: 52, status: 0, patch: { user_id: 7 } }
    ])

    await expect(deleteUser({ uid: 7 }, 99)).resolves.toEqual({})

    // 评论 patch (40,41) + 他人补丁下 status=0 评分 patch (50); 隐藏(51)与自己补丁(52)排除
    expect(invalidateContentByPatchIdMock).toHaveBeenCalledWith([40, 41, 50])
  })

  it('失效被删用户点赞过的他人 patch 资源详情缓存, 不受资源计数闸门约束', async () => {
    countResourcesMock.mockResolvedValue(0)
    findResourcesMock.mockImplementation(
      async (query?: { where?: { like_by?: unknown } }) =>
        query?.where?.like_by ? [{ patch_id: 60 }, { patch_id: 61 }] : []
    )

    await expect(deleteUser({ uid: 7 }, 99)).resolves.toEqual({})

    expect(findResourcesMock).toHaveBeenCalledWith({
      where: {
        like_by: { some: { user_id: 7 } },
        status: 0,
        patch: { user_id: { not: 7 } }
      },
      select: { patch_id: true },
      distinct: ['patch_id']
    })
    // 零公开资源时列表失效闸门关闭, 但点赞侧详情失效仍须执行
    expect(invalidateCacheMock).not.toHaveBeenCalled()
    expect(invalidateResourceDetailMock.mock.calls).toEqual([[60], [61]])
  })

  it('点赞 patch 与资源受影响集重叠时只失效一次', async () => {
    findResourcesInTransactionMock.mockResolvedValue([
      { patch_id: 32 },
      { patch_id: 30 }
    ])
    findResourcesMock.mockImplementation(
      async (query?: { where?: { like_by?: unknown } }) =>
        query?.where?.like_by ? [{ patch_id: 32 }, { patch_id: 70 }] : []
    )

    await expect(deleteUser({ uid: 7 }, 99)).resolves.toEqual({})

    // 32 已由 affectedPatchIds 闸门内失效, 点赞侧仅补 70
    expect(invalidateResourceDetailMock.mock.calls).toEqual([[30], [32], [70]])
  })

  it('retries serializable conflicts without repeating resource cleanup', async () => {
    // S3 收集返回 55; 点赞收集共用同一 findMany mock, 按 where 形状区分返回空
    findResourcesMock.mockImplementation(
      async (query?: { where?: { links?: unknown } }) =>
        query?.where?.links ? [{ id: 55 }] : []
    )
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
    // 清理随每次 attempt 在事务内执行 (deleteMany 幂等, 重试安全)
    expect(deleteOrphanReportsMock).toHaveBeenCalledTimes(2)
    expect(deleteTokenMock).toHaveBeenCalledTimes(1)
    // recalcPatchType 与 enqueueSearchOutbox 事务内两次尝试各跑一次; 首次尝试(91)
    // 的入队在回滚事务内、随事务一并丢弃(与 recalc 同), 不泄漏靠事务原子性
    expect(recalcPatchTypeMock.mock.calls).toEqual([
      [91, transactionClient],
      [92, transactionClient]
    ])
    expect(enqueueSearchOutboxMock.mock.calls).toEqual([
      [transactionClient, 91],
      [transactionClient, 92]
    ])
    // 事务后 kick 仅一次(不随重试次数增加)
    expect(kickDrainMock).toHaveBeenCalledTimes(1)
    // Serializable 重试仅提交最终 attempt: 缓存失效不含被回滚 attempt 的 uid-91
    expect(invalidatePatchContentCacheMock.mock.calls).toEqual([['uid-92']])
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
    expect(invalidatePatchContentCacheMock).not.toHaveBeenCalled()
  })
})
