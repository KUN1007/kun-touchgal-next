import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  userFindUniqueMock,
  resourceFindUniqueMock,
  transactionMock,
  transactionUserUpdateMock,
  transactionResourceDeleteMock,
  transactionAdminLogCreateMock,
  cleanupResourceCommentDerivativesMock,
  enqueueResourceLinkDeletionsMock,
  recalcPatchTypeMock,
  sanitizeResourceLinksForAuditLogMock,
  deletePendingModerationTasksMock,
  deletePendingAppealsMock,
  deleteOrphanReportsMock,
  enqueueSearchOutboxMock,
  queueSearchSyncMock,
  invalidatePatchResourceDetailCacheMock,
  invalidateResourceListCacheMock,
  invalidatePatchContentCacheMock,
  invalidateUserSessionMock,
  invalidateUserPendingResourceCacheMock,
  kickS3DeletionDrainMock
} = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  resourceFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  transactionUserUpdateMock: vi.fn(),
  transactionResourceDeleteMock: vi.fn(),
  transactionAdminLogCreateMock: vi.fn(),
  cleanupResourceCommentDerivativesMock: vi.fn(),
  enqueueResourceLinkDeletionsMock: vi.fn(),
  recalcPatchTypeMock: vi.fn(),
  sanitizeResourceLinksForAuditLogMock: vi.fn(),
  deletePendingModerationTasksMock: vi.fn(),
  deletePendingAppealsMock: vi.fn(),
  deleteOrphanReportsMock: vi.fn(),
  enqueueSearchOutboxMock: vi.fn(),
  queueSearchSyncMock: vi.fn(),
  invalidatePatchResourceDetailCacheMock: vi.fn(),
  invalidateResourceListCacheMock: vi.fn(),
  invalidatePatchContentCacheMock: vi.fn(),
  invalidateUserSessionMock: vi.fn(),
  invalidateUserPendingResourceCacheMock: vi.fn(),
  kickS3DeletionDrainMock: vi.fn()
}))

const transactionClient = {
  user: { update: transactionUserUpdateMock },
  patch_resource: { delete: transactionResourceDeleteMock },
  admin_log: { create: transactionAdminLogCreateMock }
}

vi.mock('~/prisma/index', () => ({
  prisma: {
    user: { findUnique: userFindUniqueMock },
    patch_resource: { findUnique: resourceFindUniqueMock },
    $transaction: transactionMock
  }
}))

vi.mock('~/app/api/patch/resource/_helper', () => ({
  cleanupResourceCommentDerivatives: cleanupResourceCommentDerivativesMock,
  enqueueResourceLinkDeletions: enqueueResourceLinkDeletionsMock,
  recalcPatchType: recalcPatchTypeMock,
  sanitizeResourceLinksForAuditLog: sanitizeResourceLinksForAuditLogMock
}))

vi.mock('~/app/api/patch/resource/cache', () => ({
  invalidatePatchResourceDetailCache: invalidatePatchResourceDetailCacheMock
}))

vi.mock('~/app/api/resource/cache', () => ({
  invalidateResourceListCache: invalidateResourceListCacheMock
}))

vi.mock('~/app/api/patch/cache', () => ({
  invalidatePatchContentCache: invalidatePatchContentCacheMock
}))

vi.mock('~/app/api/user/session/cache', () => ({
  invalidateUserSession: invalidateUserSessionMock
}))

vi.mock('~/app/api/utils/pendingResourceCache', () => ({
  invalidateUserPendingResourceCache: invalidateUserPendingResourceCacheMock
}))

vi.mock('~/server/moderation/submit', () => ({
  deletePendingModerationTasks: deletePendingModerationTasksMock
}))

vi.mock('~/server/moderation/appeal', () => ({
  deletePendingAppeals: deletePendingAppealsMock
}))

vi.mock('~/server/report/pending', () => ({
  deleteOrphanReports: deleteOrphanReportsMock
}))

vi.mock('~/server/search/sync', () => ({
  enqueueSearchOutbox: enqueueSearchOutboxMock,
  queueSearchSync: queueSearchSyncMock
}))

vi.mock('~/server/storage/s3Outbox', () => ({
  kickS3DeletionDrain: kickS3DeletionDrainMock
}))

import { deleteResource } from '~/app/api/patch/resource/delete'
import { deleteResource as adminDeleteResource } from '~/app/api/admin/resource/delete'

// 事务外预取的快照, 权限判定与 S3 链接收集用它
const buildSnapshot = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  status: 0,
  section: 'galgame',
  user_id: 7,
  patch_id: 10,
  links: [],
  patch: { name: 'Patch' },
  ...overrides
})

// 事务内 delete 的返回值, 即该行被删除瞬间的真实状态
const buildDeleted = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  status: 0,
  section: 'galgame',
  user_id: 7,
  patch_id: 10,
  ...overrides
})

beforeEach(() => {
  vi.resetAllMocks()
  userFindUniqueMock.mockResolvedValue({ id: 9, name: 'Admin' })
  cleanupResourceCommentDerivativesMock.mockResolvedValue(undefined)
  invalidatePatchContentCacheMock.mockResolvedValue(undefined)
  recalcPatchTypeMock.mockResolvedValue('patch-10')
  sanitizeResourceLinksForAuditLogMock.mockReturnValue([])
  transactionMock.mockImplementation(
    async (callback: (client: typeof transactionClient) => unknown) =>
      callback(transactionClient)
  )
  transactionUserUpdateMock.mockResolvedValue({})
})

// 闸门读 delete 的返回值而非事务外快照: 两者之间存在并发 approve / 隐藏的窗口
describe('删除资源按删除瞬间状态分派缓存失效', () => {
  it('删除 section=galgame 的公开资源只失效详情缓存', async () => {
    resourceFindUniqueMock.mockResolvedValue(buildSnapshot())
    transactionResourceDeleteMock.mockResolvedValue(buildDeleted())

    await deleteResource({ resourceId: 1 }, 7, 2)

    expect(invalidatePatchResourceDetailCacheMock).toHaveBeenCalledTimes(1)
    expect(invalidateResourceListCacheMock).not.toHaveBeenCalled()
  })

  it('删除 section=patch 的公开资源两个缓存都失效', async () => {
    resourceFindUniqueMock.mockResolvedValue(
      buildSnapshot({ section: 'patch' })
    )
    transactionResourceDeleteMock.mockResolvedValue(
      buildDeleted({ section: 'patch' })
    )

    await deleteResource({ resourceId: 1 }, 7, 2)

    expect(invalidatePatchResourceDetailCacheMock).toHaveBeenCalledTimes(1)
    expect(invalidateResourceListCacheMock).toHaveBeenCalledTimes(1)
  })

  // 快照 status=2, 并发 approve 提交后该行已是 0: 无守卫的 delete 删掉的是公开行
  it('快照为待审核但删除时已通过审核, 仍失效详情缓存', async () => {
    resourceFindUniqueMock.mockResolvedValue(buildSnapshot({ status: 2 }))
    transactionResourceDeleteMock.mockResolvedValue(buildDeleted({ status: 0 }))

    await deleteResource({ resourceId: 1 }, 7, 3)

    expect(invalidatePatchResourceDetailCacheMock).toHaveBeenCalledTimes(1)
    expect(invalidateUserPendingResourceCacheMock).not.toHaveBeenCalled()
  })

  // 反向: 快照 status=0, 并发隐藏后该行已是 1, 不在公开集里
  it('快照为公开但删除时已被隐藏, 不失效详情缓存', async () => {
    resourceFindUniqueMock.mockResolvedValue(buildSnapshot())
    transactionResourceDeleteMock.mockResolvedValue(buildDeleted({ status: 1 }))

    await deleteResource({ resourceId: 1 }, 7, 2)

    expect(invalidatePatchResourceDetailCacheMock).not.toHaveBeenCalled()
    expect(invalidateResourceListCacheMock).not.toHaveBeenCalled()
  })

  it('删除待审核资源失效作者的 pending 缓存而非详情缓存', async () => {
    resourceFindUniqueMock.mockResolvedValue(buildSnapshot({ status: 3 }))
    transactionResourceDeleteMock.mockResolvedValue(buildDeleted({ status: 3 }))

    await deleteResource({ resourceId: 1 }, 7, 3)

    expect(invalidatePatchResourceDetailCacheMock).not.toHaveBeenCalled()
    expect(invalidateUserPendingResourceCacheMock).toHaveBeenCalledWith(7)
  })

  it('管理员删除同样按删除瞬间状态判定', async () => {
    resourceFindUniqueMock.mockResolvedValue(buildSnapshot({ status: 3 }))
    transactionResourceDeleteMock.mockResolvedValue(buildDeleted({ status: 0 }))

    await adminDeleteResource({ resourceId: 1 }, 9)

    expect(invalidatePatchResourceDetailCacheMock).toHaveBeenCalledTimes(1)
    expect(invalidateUserPendingResourceCacheMock).not.toHaveBeenCalled()
  })
})

// 举报外键 SET NULL: 资源行删除后按 NULL 目标清理级联置空的孤儿 (锁序一致)
describe('资源删除清理其评论的 pending 举报', () => {
  it('用户删除: cleanup 在删除前, 孤儿举报清理在删除后', async () => {
    resourceFindUniqueMock.mockResolvedValue(buildSnapshot())
    transactionResourceDeleteMock.mockResolvedValue(buildDeleted())

    await deleteResource({ resourceId: 1 }, 7, 2)

    expect(
      cleanupResourceCommentDerivativesMock.mock.invocationCallOrder[0]
    ).toBeLessThan(transactionResourceDeleteMock.mock.invocationCallOrder[0])
    expect(deleteOrphanReportsMock).toHaveBeenCalledWith(
      'comment',
      transactionClient
    )
    expect(
      transactionResourceDeleteMock.mock.invocationCallOrder[0]
    ).toBeLessThan(deleteOrphanReportsMock.mock.invocationCallOrder[0])
  })

  it('管理员删除: 同款清理顺序', async () => {
    resourceFindUniqueMock.mockResolvedValue(buildSnapshot())
    transactionResourceDeleteMock.mockResolvedValue(buildDeleted())

    await adminDeleteResource({ resourceId: 1 }, 9)

    expect(
      cleanupResourceCommentDerivativesMock.mock.invocationCallOrder[0]
    ).toBeLessThan(transactionResourceDeleteMock.mock.invocationCallOrder[0])
    expect(deleteOrphanReportsMock).toHaveBeenCalledWith(
      'comment',
      transactionClient
    )
    expect(
      transactionResourceDeleteMock.mock.invocationCallOrder[0]
    ).toBeLessThan(deleteOrphanReportsMock.mock.invocationCallOrder[0])
  })
})
