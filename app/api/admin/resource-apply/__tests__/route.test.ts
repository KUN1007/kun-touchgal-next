import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  kunParsePutBodyMock,
  verifyHeaderCookieMock,
  findResourceMock,
  findAdminMock,
  transactionMock,
  txQueryRawMock,
  txLinkFindManyMock,
  deleteResourceMock,
  updateResourceMock,
  createLogMock,
  createMessageMock,
  cleanupDerivativesMock,
  deleteOrphanReportsMock,
  enqueueLinkDelMock,
  recalcTypeMock,
  invalidateResourceListMock,
  invalidateContentMock,
  invalidatePendingMock,
  invalidateUnreadMock,
  queueSearchSyncMock,
  enqueueOutboxMock,
  kickDrainMock
} = vi.hoisted(() => ({
  kunParsePutBodyMock: vi.fn(),
  verifyHeaderCookieMock: vi.fn(),
  findResourceMock: vi.fn(),
  findAdminMock: vi.fn(),
  transactionMock: vi.fn(),
  txQueryRawMock: vi.fn(),
  txLinkFindManyMock: vi.fn(),
  deleteResourceMock: vi.fn(),
  updateResourceMock: vi.fn(),
  createLogMock: vi.fn(),
  createMessageMock: vi.fn(),
  cleanupDerivativesMock: vi.fn(),
  deleteOrphanReportsMock: vi.fn(),
  enqueueLinkDelMock: vi.fn(),
  recalcTypeMock: vi.fn(),
  invalidateResourceListMock: vi.fn(),
  invalidateContentMock: vi.fn(),
  invalidatePendingMock: vi.fn(),
  invalidateUnreadMock: vi.fn(),
  queueSearchSyncMock: vi.fn(),
  enqueueOutboxMock: vi.fn(),
  kickDrainMock: vi.fn()
}))

const events: string[] = []
const transactionClient = {
  patch_resource: {
    deleteMany: deleteResourceMock,
    updateMany: updateResourceMock
  },
  patch_resource_link: { findMany: txLinkFindManyMock },
  admin_log: { create: createLogMock },
  $queryRaw: txQueryRawMock
}

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' }
      })
  }
}))

vi.mock('~/app/api/utils/parseQuery', () => ({
  kunParsePutBody: kunParsePutBodyMock
}))

vi.mock('~/middleware/_verifyHeaderCookie', () => ({
  verifyHeaderCookie: verifyHeaderCookieMock
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_resource: { findUnique: findResourceMock },
    user: { findUnique: findAdminMock },
    $transaction: transactionMock
  }
}))

vi.mock('~/app/api/utils/message', () => ({
  createMessage: createMessageMock
}))

vi.mock('~/app/api/patch/resource/_helper', () => ({
  cleanupResourceCommentDerivatives: cleanupDerivativesMock,
  enqueueResourceLinkDeletions: enqueueLinkDelMock,
  recalcPatchType: recalcTypeMock
}))

vi.mock('~/server/report/pending', () => ({
  deleteOrphanReports: deleteOrphanReportsMock
}))

vi.mock('~/app/api/resource/cache', () => ({
  invalidateResourceListCache: invalidateResourceListMock
}))

vi.mock('~/app/api/patch/cache', () => ({
  invalidatePatchContentCache: invalidateContentMock
}))

vi.mock('~/app/api/utils/pendingResourceCache', () => ({
  invalidateUserPendingResourceCache: invalidatePendingMock
}))

vi.mock('~/app/api/message/unread/cache', () => ({
  invalidateUnread: invalidateUnreadMock
}))

vi.mock('~/server/search/sync', () => ({
  queueSearchSync: queueSearchSyncMock,
  enqueueSearchOutbox: enqueueOutboxMock
}))

vi.mock('~/server/storage/s3Outbox', () => ({
  kickS3DeletionDrain: kickDrainMock
}))

import { PUT as declinePut } from '~/app/api/admin/resource-apply/decline/route'
import { PUT as approvePut } from '~/app/api/admin/resource-apply/approve/route'

const request = new Request('http://localhost/api/admin/resource-apply', {
  method: 'PUT'
}) as unknown as Parameters<typeof declinePut>[0]

const pendingResource = {
  id: 3,
  name: 'r',
  section: 'patch',
  status: 2,
  user_id: 7,
  patch_id: 10,
  user: { name: 'author' },
  patch: { name: 'p', unique_id: 'unique-x' },
  links: [
    { storage: 's3', content: 'c', hash: 'h', s3_key: 'patch/10/h.zip' },
    { storage: 'user', content: 'https://example.com', hash: '', s3_key: '' }
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  events.length = 0
  kunParsePutBodyMock.mockResolvedValue({ resourceId: 3, reason: '不合规' })
  verifyHeaderCookieMock.mockResolvedValue({ uid: 99, role: 4 })
  findResourceMock.mockResolvedValue(pendingResource)
  findAdminMock.mockResolvedValue({ id: 99, name: 'admin' })
  // 事务首条 FOR UPDATE 命中行; S3 入队的事实源是锁下重读的 links
  txQueryRawMock.mockResolvedValue([{ id: 3 }])
  txLinkFindManyMock.mockResolvedValue(pendingResource.links)
  deleteResourceMock.mockResolvedValue({ count: 1 })
  updateResourceMock.mockResolvedValue({ count: 1 })
  createLogMock.mockResolvedValue({})
  createMessageMock.mockResolvedValue({})
  cleanupDerivativesMock.mockResolvedValue(undefined)
  deleteOrphanReportsMock.mockResolvedValue(undefined)
  enqueueLinkDelMock.mockResolvedValue(undefined)
  recalcTypeMock.mockResolvedValue('unique-x')
  invalidateResourceListMock.mockResolvedValue(undefined)
  invalidateContentMock.mockResolvedValue(undefined)
  invalidatePendingMock.mockResolvedValue(undefined)
  invalidateUnreadMock.mockResolvedValue(undefined)
  queueSearchSyncMock.mockReturnValue(undefined)
  enqueueOutboxMock.mockResolvedValue(undefined)
  kickDrainMock.mockReturnValue(undefined)
  transactionMock.mockImplementation(
    async (callback: (tx: typeof transactionClient) => Promise<unknown>) => {
      const result = await callback(transactionClient)
      events.push('transaction-commit')
      return result
    }
  )
})

describe('resource-apply decline', () => {
  it('deletes a pending resource under a status guard and drains the s3 outbox', async () => {
    const response = await declinePut(request)

    expect(await response.json()).toEqual({})
    // 回归护栏: where 必须带 status 2, 退回裸 delete/无条件 deleteMany 即失败
    expect(deleteResourceMock).toHaveBeenCalledWith({
      where: { id: 3, status: 2 }
    })
    // 评论衍生物须先于删除清理, 否则级联后无从收集 comment id
    expect(cleanupDerivativesMock.mock.invocationCallOrder[0]).toBeLessThan(
      deleteResourceMock.mock.invocationCallOrder[0]
    )
    // 必须收到事务 client: 守卫在它之后, 未命中时靠回滚撤销它的写入. 回调形参名
    // 遮蔽了模块级 prisma, 改名重构漏改这里会静默落到 autocommit 连接上
    expect(cleanupDerivativesMock).toHaveBeenCalledWith(transactionClient, 3)
    // 举报外键 SET NULL: 资源行删除后按 NULL 目标清理级联置空的孤儿
    expect(deleteOrphanReportsMock).toHaveBeenCalledWith(
      'comment',
      transactionClient
    )
    expect(deleteResourceMock.mock.invocationCallOrder[0]).toBeLessThan(
      deleteOrphanReportsMock.mock.invocationCallOrder[0]
    )
    expect(enqueueLinkDelMock).toHaveBeenCalledWith(transactionClient, [
      { content: 'c', patchId: 10, hash: 'h', s3Key: 'patch/10/h.zip' }
    ])
    expect(createMessageMock).toHaveBeenCalledTimes(1)
    expect(kickDrainMock).toHaveBeenCalledTimes(1)
  })

  it('refuses to delete a resource that a concurrent approval already published', async () => {
    // 管理员先点「同意发布」(2→0) 后卡片仍在列表上, 再点「拒绝发布」: 事务外读到 status 0
    findResourceMock.mockResolvedValue({ ...pendingResource, status: 0 })
    deleteResourceMock.mockResolvedValue({ count: 0 })

    const response = await declinePut(request)

    expect(await response.json()).toBe('当前资源状态无需审核')
    // 哨兵必须逃出事务回调: 回调内吞掉改为 return 会让事务提交, 使守卫之前
    // cleanup 删掉的站内信/待裁决任务/pending 申诉永久落库而资源仍在
    expect(events).not.toContain('transaction-commit')
    // 守卫未命中必须在提交后副作用之前返回: S3 删除出箱不得被排空 (不可逆)
    expect(kickDrainMock).not.toHaveBeenCalled()
    // 资源保留 → 其评论仍在, 其举报不得清理
    expect(deleteOrphanReportsMock).not.toHaveBeenCalled()
    expect(createMessageMock).not.toHaveBeenCalled()
    expect(createLogMock).not.toHaveBeenCalled()
    expect(queueSearchSyncMock).not.toHaveBeenCalled()
    expect(invalidateResourceListMock).not.toHaveBeenCalled()
  })

  it('propagates non-sentinel transaction failures', async () => {
    deleteResourceMock.mockRejectedValue(new Error('connection lost'))

    await expect(declinePut(request)).rejects.toThrow('connection lost')
    expect(kickDrainMock).not.toHaveBeenCalled()
  })
})

describe('resource-apply approve', () => {
  it('publishes a pending resource under a status guard', async () => {
    const response = await approvePut(request)

    expect(await response.json()).toEqual({})
    expect(updateResourceMock).toHaveBeenCalledWith({
      where: { id: 3, status: 2 },
      data: { status: 0 }
    })
    expect(createMessageMock).toHaveBeenCalledTimes(1)
  })

  it('returns the string contract when the row vanished mid-flight', async () => {
    // 事务外 findUnique 与事务内写之间被并发 decline 删除: 裸 update 会抛 P2025 逃逸为 500
    updateResourceMock.mockResolvedValue({ count: 0 })

    const response = await approvePut(request)

    expect(await response.json()).toBe('当前资源状态无需审核')
    expect(createMessageMock).not.toHaveBeenCalled()
    expect(queueSearchSyncMock).not.toHaveBeenCalled()
  })

  it('keeps the pre-transaction status check', async () => {
    findResourceMock.mockResolvedValue({ ...pendingResource, status: 0 })

    const response = await approvePut(request)

    expect(await response.json()).toBe('当前资源状态无需审核')
    expect(transactionMock).not.toHaveBeenCalled()
  })
})
