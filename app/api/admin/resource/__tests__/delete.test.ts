import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  findAdminMock,
  transactionMock,
  queryRawMock,
  snapshotFindManyMock,
  deleteManyMock,
  createLogMock,
  cleanupMock,
  enqueueLinkDeletionsMock,
  recalcMock,
  invalidateDetailMock,
  invalidateListMock,
  invalidateContentMock,
  invalidatePendingMock,
  deleteTasksMock,
  deleteAppealsMock,
  deleteOrphanReportsMock,
  enqueueSearchOutboxBatchMock,
  isConflictMock,
  kickSearchMock,
  kickS3Mock
} = vi.hoisted(() => ({
  findAdminMock: vi.fn(),
  transactionMock: vi.fn(),
  queryRawMock: vi.fn(),
  snapshotFindManyMock: vi.fn(),
  deleteManyMock: vi.fn(),
  createLogMock: vi.fn(),
  cleanupMock: vi.fn(),
  enqueueLinkDeletionsMock: vi.fn(),
  recalcMock: vi.fn(),
  invalidateDetailMock: vi.fn(),
  invalidateListMock: vi.fn(),
  invalidateContentMock: vi.fn(),
  invalidatePendingMock: vi.fn(),
  deleteTasksMock: vi.fn(),
  deleteAppealsMock: vi.fn(),
  deleteOrphanReportsMock: vi.fn(),
  enqueueSearchOutboxBatchMock: vi.fn(),
  isConflictMock: vi.fn(),
  kickSearchMock: vi.fn(),
  kickS3Mock: vi.fn()
}))

const transactionClient = {
  $queryRaw: queryRawMock,
  patch_resource: {
    findMany: snapshotFindManyMock,
    deleteMany: deleteManyMock
  },
  admin_log: { create: createLogMock }
}

vi.mock('~/prisma/index', () => ({
  isPrismaTransactionConflict: isConflictMock,
  prisma: {
    user: { findUnique: findAdminMock },
    $transaction: transactionMock
  }
}))

vi.mock('~/app/api/patch/resource/_helper', () => ({
  cleanupResourceCommentDerivatives: cleanupMock,
  enqueueResourceLinkDeletions: enqueueLinkDeletionsMock,
  recalcPatchType: recalcMock,
  // 测试替身只保留非敏感列, 与真实实现「剔除 content/password/code/hash/s3_key」等价
  sanitizeResourceLinksForAuditLog: (
    links: Array<{ id: number; storage: string }>
  ) => links.map(({ id, storage }) => ({ id, storage }))
}))

vi.mock('~/app/api/patch/resource/cache', () => ({
  invalidatePatchResourceDetailCache: invalidateDetailMock
}))

vi.mock('~/app/api/resource/cache', () => ({
  invalidateResourceListCache: invalidateListMock
}))

vi.mock('~/app/api/patch/cache', () => ({
  invalidatePatchContentCache: invalidateContentMock
}))

vi.mock('~/app/api/utils/pendingResourceCache', () => ({
  invalidateUserPendingResourceCache: invalidatePendingMock
}))

vi.mock('~/server/moderation/submit', () => ({
  deletePendingModerationTasks: deleteTasksMock
}))

vi.mock('~/server/moderation/appeal', () => ({
  deletePendingAppeals: deleteAppealsMock
}))

vi.mock('~/server/report/pending', () => ({
  deleteOrphanReports: deleteOrphanReportsMock
}))

vi.mock('~/server/search/sync', () => ({
  enqueueSearchOutboxBatch: enqueueSearchOutboxBatchMock,
  kickSearchOutboxDrain: kickSearchMock
}))

vi.mock('~/server/storage/s3Outbox', () => ({
  kickS3DeletionDrain: kickS3Mock
}))

import { deleteResource } from '~/app/api/admin/resource/delete'

const created = new Date('2026-01-01T00:00:00.000Z')

const link = (
  id: number,
  storage: 's3' | 'user',
  overrides: Record<string, unknown> = {}
) => ({
  id,
  storage,
  content: `content-${id}`,
  password: 'pw',
  code: 'code',
  hash: `hash-${id}`,
  s3_key: storage === 's3' ? `key-${id}` : '',
  ...overrides
})

const resource = (
  id: number,
  patchId: number,
  status: number,
  section: string,
  userId: number,
  links: ReturnType<typeof link>[] = []
) => ({
  id,
  section,
  name: `resource-${id}`,
  note: '',
  type: [],
  language: [],
  platform: [],
  emulator_type: [],
  model_name: '',
  download: 0,
  status,
  user_id: userId,
  patch_id: patchId,
  created,
  updated: created,
  patch: { name: `patch-${patchId}` },
  links
})

const lockSqlOf = (call: unknown[]) =>
  (call[0] as TemplateStringsArray).join('?').replace(/\s+/g, ' ').trim()

beforeEach(() => {
  vi.resetAllMocks()
  findAdminMock.mockResolvedValue({ id: 99, name: 'admin' })
  queryRawMock.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }])
  snapshotFindManyMock.mockResolvedValue([
    resource(1, 10, 0, 'patch', 5, [link(11, 's3'), link(12, 'user')]),
    resource(2, 10, 2, 'galgame', 6, [link(21, 's3')]),
    resource(3, 20, 1, 'patch', 7)
  ])
  deleteManyMock.mockResolvedValue({ count: 3 })
  createLogMock.mockResolvedValue({})
  cleanupMock.mockResolvedValue(undefined)
  enqueueLinkDeletionsMock.mockResolvedValue(undefined)
  recalcMock.mockImplementation(async (patchId: number) => `unique-${patchId}`)
  invalidateDetailMock.mockResolvedValue(undefined)
  invalidateListMock.mockResolvedValue(undefined)
  invalidateContentMock.mockResolvedValue(undefined)
  invalidatePendingMock.mockResolvedValue(undefined)
  deleteTasksMock.mockResolvedValue(undefined)
  deleteAppealsMock.mockResolvedValue(undefined)
  deleteOrphanReportsMock.mockResolvedValue(undefined)
  enqueueSearchOutboxBatchMock.mockResolvedValue(undefined)
  isConflictMock.mockReturnValue(false)
  transactionMock.mockImplementation(
    async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient)
  )
})

describe('deleteResource 批量删除', () => {
  it('一条升序 FOR UPDATE 锁全部行, 单次 deleteMany, 派生清理按数组调用', async () => {
    await expect(
      deleteResource({ resourceIds: [3, 1, 2] }, 99)
    ).resolves.toEqual({ count: 3 })

    expect(transactionMock).toHaveBeenCalledTimes(1)

    expect(queryRawMock).toHaveBeenCalledTimes(1)
    const sql = lockSqlOf(queryRawMock.mock.calls[0])
    expect(sql).toContain('FROM patch_resource')
    expect(sql).toContain('ANY(?::int[])')
    expect(sql).toContain('ORDER BY id')
    expect(sql).toContain('FOR UPDATE')
    expect(queryRawMock.mock.calls[0][1]).toEqual([3, 1, 2])

    // 锁下重读的集合 (而非入参) 是删除与派生清理的事实源
    expect(snapshotFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [1, 2, 3] } } })
    )
    expect(deleteManyMock).toHaveBeenCalledTimes(1)
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { id: { in: [1, 2, 3] } }
    })
    expect(deleteTasksMock).toHaveBeenCalledWith(
      'resource',
      [1, 2, 3],
      transactionClient
    )
    expect(deleteAppealsMock).toHaveBeenCalledWith(
      'resource',
      [1, 2, 3],
      transactionClient
    )
    expect(deleteOrphanReportsMock).toHaveBeenCalledWith(
      'comment',
      transactionClient
    )

    // 评论派生清理整批一次, 且在行删除之前 (评论行尚存时)
    expect(cleanupMock).toHaveBeenCalledTimes(1)
    expect(cleanupMock).toHaveBeenCalledWith(transactionClient, [1, 2, 3])
    expect(cleanupMock.mock.invocationCallOrder[0]).toBeLessThan(
      deleteManyMock.mock.invocationCallOrder[0]
    )
    expect(queryRawMock.mock.invocationCallOrder[0]).toBeLessThan(
      snapshotFindManyMock.mock.invocationCallOrder[0]
    )
    expect(deleteManyMock.mock.invocationCallOrder[0]).toBeLessThan(
      deleteOrphanReportsMock.mock.invocationCallOrder[0]
    )
  })

  it('patch 通告锁与搜索入箱按 patchId 去重升序, S3 仅入队 s3 链接', async () => {
    snapshotFindManyMock.mockResolvedValue([
      resource(1, 20, 0, 'patch', 5, [link(11, 's3')]),
      resource(2, 10, 0, 'patch', 5, [link(21, 'user')]),
      resource(3, 20, 0, 'patch', 5, [link(31, 's3')])
    ])

    await deleteResource({ resourceIds: [1, 2, 3] }, 99)

    expect(recalcMock.mock.calls.map((call) => call[0])).toEqual([10, 20])
    expect(recalcMock).toHaveBeenCalledWith(10, transactionClient)
    expect(enqueueSearchOutboxBatchMock).toHaveBeenCalledTimes(1)
    expect(enqueueSearchOutboxBatchMock).toHaveBeenCalledWith(
      transactionClient,
      [10, 20]
    )
    expect(recalcMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      deleteManyMock.mock.invocationCallOrder[0]
    )

    expect(enqueueLinkDeletionsMock).toHaveBeenCalledTimes(1)
    expect(enqueueLinkDeletionsMock).toHaveBeenCalledWith(transactionClient, [
      { content: 'content-11', patchId: 20, hash: 'hash-11', s3Key: 'key-11' },
      { content: 'content-31', patchId: 20, hash: 'hash-31', s3Key: 'key-31' }
    ])
    // 入队在事务内 (审计日志之前), 与行删除原子提交
    expect(enqueueLinkDeletionsMock.mock.invocationCallOrder[0]).toBeLessThan(
      createLogMock.mock.invocationCallOrder[0]
    )
  })

  it('提交后失效沿用单删闸门: 仅 status=0 的 patch 失效详情, section=patch 才失效列表, 2/3 失效作者 pending', async () => {
    await deleteResource({ resourceIds: [1, 2, 3] }, 99)

    expect(invalidateContentMock.mock.calls.map((call) => call[0])).toEqual([
      'unique-10',
      'unique-20'
    ])
    // 资源 3 (patch 20) 删除时 status=1, 不在详情集合里
    expect(invalidateDetailMock).toHaveBeenCalledTimes(1)
    expect(invalidateDetailMock).toHaveBeenCalledWith(10)
    expect(invalidateListMock).toHaveBeenCalledTimes(1)
    // 仅资源 2 (status=2, user 6) 触发 pending 失效
    expect(invalidatePendingMock).toHaveBeenCalledTimes(1)
    expect(invalidatePendingMock).toHaveBeenCalledWith(6)

    expect(kickSearchMock).toHaveBeenCalledTimes(1)
    expect(kickS3Mock).toHaveBeenCalledTimes(1)
    // 失效与 kick 都在事务提交之后
    expect(transactionMock.mock.invocationCallOrder[0]).toBeLessThan(
      invalidateContentMock.mock.invocationCallOrder[0]
    )
    expect(transactionMock.mock.invocationCallOrder[0]).toBeLessThan(
      kickSearchMock.mock.invocationCallOrder[0]
    )
  })

  it('被删行均非 status=0 时不失效详情与列表', async () => {
    snapshotFindManyMock.mockResolvedValue([
      resource(1, 10, 1, 'patch', 5),
      resource(2, 10, 3, 'patch', 6)
    ])
    queryRawMock.mockResolvedValue([{ id: 1 }, { id: 2 }])

    await expect(deleteResource({ resourceIds: [1, 2] }, 99)).resolves.toEqual({
      count: 2
    })

    expect(invalidateDetailMock).not.toHaveBeenCalled()
    expect(invalidateListMock).not.toHaveBeenCalled()
    expect(invalidatePendingMock).toHaveBeenCalledWith(6)
  })

  it('锁到 0 行返回业务错误且无任何写入', async () => {
    queryRawMock.mockResolvedValue([])

    await expect(deleteResource({ resourceIds: [1, 2, 3] }, 99)).resolves.toBe(
      '未找到对应的资源'
    )

    expect(snapshotFindManyMock).not.toHaveBeenCalled()
    expect(cleanupMock).not.toHaveBeenCalled()
    expect(deleteManyMock).not.toHaveBeenCalled()
    expect(recalcMock).not.toHaveBeenCalled()
    expect(enqueueLinkDeletionsMock).not.toHaveBeenCalled()
    expect(createLogMock).not.toHaveBeenCalled()
    expect(invalidateContentMock).not.toHaveBeenCalled()
    expect(kickSearchMock).not.toHaveBeenCalled()
    expect(kickS3Mock).not.toHaveBeenCalled()
  })

  it('单条删除保持原有全量快照审计格式, 敏感链接字段已脱敏', async () => {
    queryRawMock.mockResolvedValue([{ id: 1 }])
    snapshotFindManyMock.mockResolvedValue([
      resource(1, 10, 0, 'patch', 5, [link(11, 's3')])
    ])

    await expect(deleteResource({ resourceIds: [1] }, 99)).resolves.toEqual({
      count: 1
    })

    expect(createLogMock).toHaveBeenCalledTimes(1)
    const content = createLogMock.mock.calls[0][0].data.content as string
    expect(content).toContain('管理员 admin 删除了一个资源')
    expect(content).toContain('Galgame 名:\npatch-10')
    expect(content).toContain('资源信息:')
    expect(content).toContain('"name":"resource-1"')
    expect(content).not.toContain('content-11')
    expect(content).not.toContain('key-11')
    expect(content).not.toContain('"password"')
  })

  it('批量审计日志记录全部 id 与前 10 条摘要', async () => {
    const ids = Array.from({ length: 12 }, (_, i) => i + 1)
    queryRawMock.mockResolvedValue(ids.map((id) => ({ id })))
    snapshotFindManyMock.mockResolvedValue(
      ids.map((id) => resource(id, 10, 0, 'patch', 5, [link(id * 10, 's3')]))
    )

    await deleteResource({ resourceIds: ids }, 99)

    const content = createLogMock.mock.calls[0][0].data.content as string
    expect(content).toContain('管理员 admin 批量删除了 12 条资源')
    expect(content).toContain(`资源 ID: ${ids.join(', ')}`)
    expect(content).toContain('其余 2 条资源摘要已省略')
    expect(content).toContain('"patchName":"patch-10"')
    expect(content).toContain('"linkCount":1')
    expect(content).not.toContain('content-')
  })

  it('事务超时上调至 60s, 单次 deleteMany 与整批派生清理共用一个事务', async () => {
    await deleteResource({ resourceIds: [1, 2, 3] }, 99)

    expect(transactionMock).toHaveBeenCalledTimes(1)
    expect(transactionMock.mock.calls[0][1]).toEqual({ timeout: 60000 })
  })

  it('40P01 冲突重试整个事务, 提交后失效只按最终一次的结果执行', async () => {
    isConflictMock.mockReturnValue(true)
    let attempt = 0
    transactionMock.mockImplementation(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) => {
        const result = await callback(transactionClient)
        attempt++
        if (attempt === 1) {
          throw new Error('deadlock detected')
        }
        return result
      }
    )

    await expect(
      deleteResource({ resourceIds: [1, 2, 3] }, 99)
    ).resolves.toEqual({ count: 3 })

    expect(transactionMock).toHaveBeenCalledTimes(2)
    expect(invalidateContentMock).toHaveBeenCalledTimes(2)
    expect(kickSearchMock).toHaveBeenCalledTimes(1)
  })

  it('非冲突错误不重试直接抛出', async () => {
    transactionMock.mockRejectedValue(new Error('boom'))

    await expect(
      deleteResource({ resourceIds: [1, 2, 3] }, 99)
    ).rejects.toThrow('boom')

    expect(transactionMock).toHaveBeenCalledTimes(1)
    expect(kickSearchMock).not.toHaveBeenCalled()
  })

  it('连续 3 次冲突后放弃', async () => {
    isConflictMock.mockReturnValue(true)
    transactionMock.mockRejectedValue(new Error('deadlock detected'))

    await expect(
      deleteResource({ resourceIds: [1, 2, 3] }, 99)
    ).rejects.toThrow('deadlock detected')

    expect(transactionMock).toHaveBeenCalledTimes(3)
  })
})
