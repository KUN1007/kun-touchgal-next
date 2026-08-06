import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  findAdminMock,
  findAppealMock,
  findRatingMock,
  findResourceMock,
  findCommentMock,
  transactionMock,
  claimAppealMock,
  updateRatingMock,
  deleteRatingMock,
  deleteResourceMock,
  txFindResourceMock,
  deleteCommentMock,
  txFindCommentMock,
  txQueryRawMock,
  createMessageMock,
  createLogMock,
  recomputeOneMock,
  deletePendingTasksMock,
  deletePendingAppealsMock,
  deleteOrphanReportsMock,
  isPrismaConflictMock,
  invalidateContentMock,
  invalidateContentByPatchIdMock,
  invalidateCommentCacheMock,
  recalcTypeMock,
  enqueueOutboxMock,
  enqueueLinkDelMock,
  sanitizeLinksMock,
  queueSearchSyncMock,
  kickDrainMock
} = vi.hoisted(() => ({
  findAdminMock: vi.fn(),
  findAppealMock: vi.fn(),
  findRatingMock: vi.fn(),
  findResourceMock: vi.fn(),
  findCommentMock: vi.fn(),
  transactionMock: vi.fn(),
  claimAppealMock: vi.fn(),
  updateRatingMock: vi.fn(),
  deleteRatingMock: vi.fn(),
  deleteResourceMock: vi.fn(),
  txFindResourceMock: vi.fn(),
  deleteCommentMock: vi.fn(),
  txFindCommentMock: vi.fn(),
  txQueryRawMock: vi.fn(),
  createMessageMock: vi.fn(),
  createLogMock: vi.fn(),
  recomputeOneMock: vi.fn(),
  deletePendingTasksMock: vi.fn(),
  deletePendingAppealsMock: vi.fn(),
  deleteOrphanReportsMock: vi.fn(),
  isPrismaConflictMock: vi.fn(),
  invalidateContentMock: vi.fn(),
  invalidateContentByPatchIdMock: vi.fn(),
  invalidateCommentCacheMock: vi.fn(),
  recalcTypeMock: vi.fn(),
  enqueueOutboxMock: vi.fn(),
  enqueueLinkDelMock: vi.fn(),
  sanitizeLinksMock: vi.fn(),
  queueSearchSyncMock: vi.fn(),
  kickDrainMock: vi.fn()
}))

const events: string[] = []
let recomputeStarted: Promise<void>
let finishRecompute: () => void
const transactionClient = {
  moderation_appeal: { updateMany: claimAppealMock },
  patch_rating: { updateMany: updateRatingMock, deleteMany: deleteRatingMock },
  patch_resource: {
    deleteMany: deleteResourceMock,
    findUnique: txFindResourceMock
  },
  patch_comment: {
    deleteMany: deleteCommentMock,
    findUnique: txFindCommentMock
  },
  admin_log: { create: createLogMock },
  $queryRaw: txQueryRawMock
}

vi.mock('~/prisma/index', () => ({
  prisma: {
    user: { findUnique: findAdminMock },
    moderation_appeal: { findUnique: findAppealMock },
    patch_rating: { findUnique: findRatingMock },
    patch_resource: { findUnique: findResourceMock },
    patch_comment: { findUnique: findCommentMock },
    $transaction: transactionMock
  },
  isPrismaTransactionConflict: isPrismaConflictMock
}))

vi.mock('~/app/api/utils/message', () => ({
  createMessage: createMessageMock
}))

vi.mock('~/app/api/patch/rating/stat', () => ({
  recomputePatchRatingStat: recomputeOneMock
}))

vi.mock('~/server/moderation/submit', () => ({
  deletePendingModerationTasks: deletePendingTasksMock
}))

vi.mock('~/server/moderation/appeal', () => ({
  deletePendingAppeals: deletePendingAppealsMock
}))

vi.mock('~/server/report/pending', () => ({
  deleteOrphanReports: deleteOrphanReportsMock
}))

vi.mock('~/app/api/patch/cache', () => ({
  invalidatePatchContentCache: invalidateContentMock,
  invalidatePatchContentCacheByPatchId: invalidateContentByPatchIdMock
}))

vi.mock('~/app/api/patch/comment/cache', () => ({
  invalidatePatchCommentCache: invalidateCommentCacheMock
}))

vi.mock('~/app/api/patch/resource/_helper', () => ({
  recalcPatchType: recalcTypeMock,
  enqueueResourceLinkDeletions: enqueueLinkDelMock,
  sanitizeResourceLinksForAuditLog: sanitizeLinksMock
}))

vi.mock('~/server/search/sync', () => ({
  queueSearchSync: queueSearchSyncMock,
  enqueueSearchOutbox: enqueueOutboxMock
}))

vi.mock('~/server/storage/s3Outbox', () => ({
  kickS3DeletionDrain: kickDrainMock
}))

import { handleAppeal } from '~/app/api/admin/appeal/handle'
import { APPEAL_RESULT_NOTICE } from '~/constants/appeal'
import { MODERATION_CONTENT_TYPE_MAP } from '~/constants/moderation'

const ratingAppeal = {
  id: 1,
  content_type: 'rating',
  content_id: 5,
  user_id: 7,
  status: 'pending',
  payload: { text: 'restored' }
}

beforeEach(() => {
  vi.clearAllMocks()
  events.length = 0
  const started = Promise.withResolvers<void>()
  const finished = Promise.withResolvers<void>()
  recomputeStarted = started.promise
  finishRecompute = () => {
    events.push('recompute')
    finished.resolve()
  }
  findAdminMock.mockResolvedValue({ id: 99, name: 'admin' })
  findAppealMock.mockResolvedValue(ratingAppeal)
  findRatingMock.mockResolvedValue({ patch_id: 10 })
  findResourceMock.mockResolvedValue({
    patch_id: 10,
    patch: { name: 'p' },
    links: []
  })
  findCommentMock.mockResolvedValue({ patch_id: 10 })
  claimAppealMock.mockResolvedValue({ count: 1 })
  updateRatingMock.mockResolvedValue({ count: 1 })
  deleteRatingMock.mockResolvedValue({ count: 1 })
  deleteResourceMock.mockResolvedValue({ count: 1 })
  deleteCommentMock.mockResolvedValue({ count: 1 })
  txFindResourceMock.mockResolvedValue(null)
  txFindCommentMock.mockResolvedValue(null)
  txQueryRawMock.mockResolvedValue([{ status: 2 }])
  createMessageMock.mockResolvedValue({})
  createLogMock.mockResolvedValue({})
  deletePendingTasksMock.mockResolvedValue({ count: 0 })
  deletePendingAppealsMock.mockResolvedValue({ count: 0 })
  deleteOrphanReportsMock.mockResolvedValue(undefined)
  isPrismaConflictMock.mockReturnValue(false)
  invalidateContentMock.mockResolvedValue(undefined)
  invalidateContentByPatchIdMock.mockResolvedValue(undefined)
  invalidateCommentCacheMock.mockResolvedValue(undefined)
  recalcTypeMock.mockResolvedValue('unique-x')
  enqueueOutboxMock.mockResolvedValue(undefined)
  enqueueLinkDelMock.mockResolvedValue(undefined)
  sanitizeLinksMock.mockReturnValue([])
  queueSearchSyncMock.mockReturnValue(undefined)
  kickDrainMock.mockReturnValue(undefined)
  transactionMock.mockImplementation(
    async (callback: (tx: typeof transactionClient) => Promise<unknown>) => {
      events.push('transaction-start')
      const result = await callback(transactionClient)
      events.push('transaction-commit')
      return result
    }
  )
  recomputeOneMock.mockImplementation(() => {
    started.resolve()
    return finished.promise
  })
})

describe('handleAppeal approve', () => {
  it('recomputes rating stats before an approval transaction commits', async () => {
    const result = handleAppeal({ appealId: 1, approve: true }, 99)
    await recomputeStarted
    await Promise.resolve()
    const eventsBeforeRecompute = [...events]
    finishRecompute()

    await expect(result).resolves.toEqual({})
    expect(recomputeOneMock).toHaveBeenCalledWith(10, transactionClient)
    expect(updateRatingMock.mock.invocationCallOrder[0]).toBeLessThan(
      recomputeOneMock.mock.invocationCallOrder[0]
    )
    expect(eventsBeforeRecompute).toEqual(['transaction-start'])
    expect(events).toEqual([
      'transaction-start',
      'recompute',
      'transaction-commit'
    ])
  })
})

describe('handleAppeal reject', () => {
  it('deletes a still-hidden rating and writes notice + audit inside the transaction', async () => {
    txQueryRawMock.mockResolvedValue([{ status: 2 }])

    const result = await handleAppeal({ appealId: 1, approve: false }, 99)

    expect(result).toEqual({})
    // 守卫删除: FOR UPDATE 读到隐藏态才删 (R1)
    expect(deleteRatingMock).toHaveBeenCalledWith({ where: { id: 5 } })
    // 举报外键 SET NULL: 删除后按 NULL 目标清理级联置空的孤儿 (锁序一致)
    expect(deleteOrphanReportsMock).toHaveBeenCalledWith(
      'rating',
      transactionClient
    )
    expect(deleteRatingMock.mock.invocationCallOrder[0]).toBeLessThan(
      deleteOrphanReportsMock.mock.invocationCallOrder[0]
    )
    // R3: 通知与审计随删除同事务 —— createMessage 收到 tx, admin_log 写在 tx 上
    expect(createMessageMock).toHaveBeenCalledTimes(1)
    expect(createMessageMock.mock.calls[0][1]).toBe(transactionClient)
    expect(createMessageMock.mock.calls[0][0].content).toBe(
      APPEAL_RESULT_NOTICE.rejected(MODERATION_CONTENT_TYPE_MAP.rating)
    )
    expect(createLogMock).toHaveBeenCalledTimes(1)
    expect(deleteRatingMock.mock.invocationCallOrder[0]).toBeLessThan(
      createMessageMock.mock.invocationCallOrder[0]
    )
    // didDelete=true 才触发提交后缓存失效
    expect(invalidateContentByPatchIdMock).toHaveBeenCalledWith(10)
  })

  it('keeps a restored rating and sends the "kept" notice without deleting', async () => {
    // FOR UPDATE 读到已恢复 (status 0): 并发恢复赢得竞态, 不得删除 (R1)
    txQueryRawMock.mockResolvedValue([{ status: 0 }])

    const result = await handleAppeal({ appealId: 1, approve: false }, 99)

    expect(result).toEqual({})
    expect(deleteRatingMock).not.toHaveBeenCalled()
    // 内容保留 → 其举报仍有效, 不得清理
    expect(deleteOrphanReportsMock).not.toHaveBeenCalled()
    expect(createMessageMock.mock.calls[0][0].content).toBe(
      APPEAL_RESULT_NOTICE.rejectedKept(MODERATION_CONTENT_TYPE_MAP.rating)
    )
    expect(createMessageMock.mock.calls[0][1]).toBe(transactionClient)
    // 未删除 → 不触发提交后副作用
    expect(invalidateContentByPatchIdMock).not.toHaveBeenCalled()
  })

  it('closes the appeal without side effects when the rating is already gone', async () => {
    // 内容已被并发删除: 达到拒绝目标, 关闭申诉但不重复删、不做副作用
    txQueryRawMock.mockResolvedValue([])

    const result = await handleAppeal({ appealId: 1, approve: false }, 99)

    expect(result).toEqual({})
    expect(deleteRatingMock).not.toHaveBeenCalled()
    expect(createMessageMock.mock.calls[0][0].content).toBe(
      APPEAL_RESULT_NOTICE.rejected(MODERATION_CONTENT_TYPE_MAP.rating)
    )
    expect(invalidateContentByPatchIdMock).not.toHaveBeenCalled()
  })

  it('returns an error and touches nothing when the appeal was already handled', async () => {
    // claim 失败: 抛错整体回滚, 不删不通知, 无 revertClaim 造孤儿 (R2)
    claimAppealMock.mockResolvedValue({ count: 0 })

    const result = await handleAppeal({ appealId: 1, approve: false }, 99)

    expect(result).toBe('该申诉已被处理, 请刷新后重试')
    expect(deleteRatingMock).not.toHaveBeenCalled()
    expect(createMessageMock).not.toHaveBeenCalled()
    expect(createLogMock).not.toHaveBeenCalled()
  })

  it('guards the resource delete by hidden status and fires post-commit effects', async () => {
    findAppealMock.mockResolvedValue({
      ...ratingAppeal,
      content_type: 'resource'
    })

    const result = await handleAppeal({ appealId: 1, approve: false }, 99)

    expect(result).toEqual({})
    // 守卫删除条件必须含 status: 1 (resource 隐藏态), 闭合并发取消隐藏窗口 (R1)
    expect(deleteResourceMock).toHaveBeenCalledWith({
      where: { id: 5, status: 1 }
    })
    expect(createMessageMock.mock.calls[0][1]).toBe(transactionClient)
    // 删除成功的提交后副作用
    expect(queueSearchSyncMock).toHaveBeenCalledWith(10)
    expect(invalidateContentMock).toHaveBeenCalledWith('unique-x')
    expect(kickDrainMock).toHaveBeenCalledTimes(1)
  })

  it('does not delete a resource that was restored before the transaction', async () => {
    findAppealMock.mockResolvedValue({
      ...ratingAppeal,
      content_type: 'resource'
    })
    // 守卫删除匹配 0 行 (已被恢复为 status 0), 且内容仍存在 → 保留
    deleteResourceMock.mockResolvedValue({ count: 0 })
    txFindResourceMock.mockResolvedValue({ id: 5 })

    const result = await handleAppeal({ appealId: 1, approve: false }, 99)

    expect(result).toEqual({})
    expect(createMessageMock.mock.calls[0][0].content).toBe(
      APPEAL_RESULT_NOTICE.rejectedKept(MODERATION_CONTENT_TYPE_MAP.resource)
    )
    // 资源保留 → 其评论仍在, 收集到的举报不得清理
    expect(deleteReportsByIdsMock).not.toHaveBeenCalled()
    expect(queueSearchSyncMock).not.toHaveBeenCalled()
    expect(kickDrainMock).not.toHaveBeenCalled()
  })

  it('collects resource-comment pending reports before delete and cleans them after', async () => {
    findAppealMock.mockResolvedValue({
      ...ratingAppeal,
      content_type: 'resource'
    })
    // 删除前无锁收集: 级联删评论后举报外键已置 NULL, 无从匹配
    txFindResourceMock.mockResolvedValue({
      comment: [{ id: 21 }, { id: 22 }]
    })
    collectPendingReportIdsMock.mockResolvedValue([91])

    const result = await handleAppeal({ appealId: 1, approve: false }, 99)

    expect(result).toEqual({})
    expect(collectPendingReportIdsMock).toHaveBeenCalledWith(
      'comment',
      [21, 22],
      transactionClient
    )
    expect(
      collectPendingReportIdsMock.mock.invocationCallOrder[0]
    ).toBeLessThan(deleteResourceMock.mock.invocationCallOrder[0])
    expect(deleteReportsByIdsMock).toHaveBeenCalledWith([91], transactionClient)
    expect(deleteResourceMock.mock.invocationCallOrder[0]).toBeLessThan(
      deleteReportsByIdsMock.mock.invocationCallOrder[0]
    )
  })

  it('guards the comment delete by hidden status and cleans descendants', async () => {
    findAppealMock.mockResolvedValue({
      ...ratingAppeal,
      content_type: 'comment'
    })
    // CTE 返回根+后代 id
    txQueryRawMock.mockResolvedValue([{ id: 5 }, { id: 6 }])

    const result = await handleAppeal({ appealId: 1, approve: false }, 99)

    expect(result).toEqual({})
    // 守卫删除条件含 status: 2 (comment 隐藏态)
    expect(deleteCommentMock).toHaveBeenCalledWith({
      where: { id: 5, status: 2 }
    })
    // 删除后按收集到的根+后代 id 清理审核任务与 pending 申诉
    expect(deletePendingTasksMock).toHaveBeenCalledWith(
      'comment',
      [5, 6],
      transactionClient
    )
    expect(deletePendingAppealsMock).toHaveBeenCalledWith(
      'comment',
      [5, 6],
      transactionClient
    )
    // 举报外键 SET NULL: 删除后按 NULL 目标清理级联置空的孤儿
    expect(deleteOrphanReportsMock).toHaveBeenCalledWith(
      'comment',
      transactionClient
    )
    expect(deleteCommentMock.mock.invocationCallOrder[0]).toBeLessThan(
      deleteOrphanReportsMock.mock.invocationCallOrder[0]
    )
    expect(createMessageMock.mock.calls[0][1]).toBe(transactionClient)
    expect(invalidateCommentCacheMock).toHaveBeenCalledWith(10)
  })
})
