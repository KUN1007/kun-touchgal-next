import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  resourceFindUniqueMock,
  patchFindUniqueMock,
  transactionMock,
  transactionQueryRawMock,
  transactionResourceUpdateMock,
  transactionPatchUpdateMock,
  bindUploadedResourceMock,
  enqueueResourceLinkDeletionsMock,
  recalcPatchTypeMock,
  createModerationTaskMock,
  hasPendingModerationMock,
  preScreenTextMock,
  enqueueSearchOutboxMock,
  queueSearchSyncMock,
  markdownToHtmlMock,
  invalidatePatchResourceDetailCacheMock,
  invalidateResourceListCacheMock,
  invalidatePatchContentCacheMock,
  invalidateUserPendingResourceCacheMock,
  kickS3DeletionDrainMock
} = vi.hoisted(() => ({
  resourceFindUniqueMock: vi.fn(),
  patchFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  transactionQueryRawMock: vi.fn(),
  transactionResourceUpdateMock: vi.fn(),
  transactionPatchUpdateMock: vi.fn(),
  bindUploadedResourceMock: vi.fn(),
  enqueueResourceLinkDeletionsMock: vi.fn(),
  recalcPatchTypeMock: vi.fn(),
  createModerationTaskMock: vi.fn(),
  hasPendingModerationMock: vi.fn(),
  preScreenTextMock: vi.fn(),
  enqueueSearchOutboxMock: vi.fn(),
  queueSearchSyncMock: vi.fn(),
  markdownToHtmlMock: vi.fn(),
  invalidatePatchResourceDetailCacheMock: vi.fn(),
  invalidateResourceListCacheMock: vi.fn(),
  invalidatePatchContentCacheMock: vi.fn(),
  invalidateUserPendingResourceCacheMock: vi.fn(),
  kickS3DeletionDrainMock: vi.fn()
}))

const transactionClient = {
  patch_resource: { update: transactionResourceUpdateMock },
  patch: { update: transactionPatchUpdateMock },
  $queryRaw: transactionQueryRawMock
}

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_resource: { findUnique: resourceFindUniqueMock },
    patch: { findUnique: patchFindUniqueMock },
    $transaction: transactionMock
  }
}))

vi.mock('~/app/api/patch/resource/_helper', () => ({
  bindUploadedResource: bindUploadedResourceMock,
  enqueueResourceLinkDeletions: enqueueResourceLinkDeletionsMock,
  recalcPatchType: recalcPatchTypeMock
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

vi.mock('~/app/api/utils/pendingResourceCache', () => ({
  invalidateUserPendingResourceCache: invalidateUserPendingResourceCacheMock
}))

vi.mock('~/server/moderation/submit', () => ({
  MODERATION_SKIP: { queue: false, intercept: false, dryRun: false },
  createModerationTask: createModerationTaskMock,
  hasPendingModeration: hasPendingModerationMock,
  preScreenText: preScreenTextMock
}))

vi.mock('~/server/search/sync', () => ({
  enqueueSearchOutbox: enqueueSearchOutboxMock,
  queueSearchSync: queueSearchSyncMock
}))

vi.mock('~/server/storage/s3Outbox', () => ({
  kickS3DeletionDrain: kickS3DeletionDrainMock
}))

vi.mock('~/app/api/utils/render/markdownToHtml', () => ({
  markdownToHtml: markdownToHtmlMock
}))

import { updatePatchResource } from '~/app/api/patch/resource/update'

const buildInput = (overrides: Record<string, unknown> = {}) => ({
  resourceId: 1,
  patchId: 10,
  section: 'galgame',
  name: 'New name',
  note: '',
  links: [
    {
      storage: 'user',
      hash: '',
      content: 'https://example.com',
      size: '100MB',
      code: '',
      password: ''
    }
  ],
  type: ['manual'],
  language: ['zh-Hans'],
  platform: ['windows'],
  emulatorType: [],
  modelName: '',
  ...overrides
})

// 事务外预取的快照: 守卫初检与 S3 链接收集用它, 复检场景中恒为公开态
const buildSnapshot = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  status: 0,
  section: 'galgame',
  user_id: 7,
  patch_id: 10,
  name: 'Old name',
  note: '',
  model_name: '',
  links: [],
  ...overrides
})

const buildUpdated = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  status: 0,
  section: 'galgame',
  user_id: 7,
  patch_id: 10,
  name: 'New name',
  note: '',
  model_name: '',
  emulator_type: [],
  type: ['manual'],
  language: ['zh-Hans'],
  platform: ['windows'],
  download: 0,
  created: new Date('2026-01-01'),
  user: {
    id: 7,
    name: 'User',
    avatar: '',
    role: 1,
    _count: { patch_resource: 1 }
  },
  patch: { unique_id: 'kun-10' },
  links: [],
  ...overrides
})

const INTERCEPT = { queue: true, intercept: true, dryRun: false }

const expectNoWriteNoSideEffects = () => {
  expect(transactionResourceUpdateMock).not.toHaveBeenCalled()
  expect(createModerationTaskMock).not.toHaveBeenCalled()
  expect(recalcPatchTypeMock).not.toHaveBeenCalled()
  expect(enqueueSearchOutboxMock).not.toHaveBeenCalled()
  expect(queueSearchSyncMock).not.toHaveBeenCalled()
  expect(invalidatePatchContentCacheMock).not.toHaveBeenCalled()
  expect(invalidatePatchResourceDetailCacheMock).not.toHaveBeenCalled()
  expect(invalidateResourceListCacheMock).not.toHaveBeenCalled()
  expect(invalidateUserPendingResourceCacheMock).not.toHaveBeenCalled()
  expect(kickS3DeletionDrainMock).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.resetAllMocks()
  patchFindUniqueMock.mockResolvedValue({ id: 10 })
  hasPendingModerationMock.mockResolvedValue(false)
  preScreenTextMock.mockResolvedValue(INTERCEPT)
  invalidatePatchContentCacheMock.mockResolvedValue(undefined)
  recalcPatchTypeMock.mockResolvedValue('patch-10')
  markdownToHtmlMock.mockResolvedValue('')
  transactionMock.mockImplementation(
    async (callback: (client: typeof transactionClient) => unknown) =>
      callback(transactionClient)
  )
})

// 事务外守卫读的是快照, 与事务开始之间隔着 S3 绑定/预筛的秒级窗口;
// 锁下复检封死该窗口, 否则并发的管理员隐藏 (0→1) 会被预筛拦截写回
// 待审核 (3), AI 放行 (3→0) 即静默撤销管理员隐藏
describe('更新资源在行锁下复检守卫', () => {
  it('快照公开但锁下已被管理员隐藏, 拒绝写入', async () => {
    resourceFindUniqueMock.mockResolvedValue(buildSnapshot())
    transactionQueryRawMock.mockResolvedValue([
      { status: 1, section: 'galgame' }
    ])

    const result = await updatePatchResource(buildInput(), 7, 1)

    expect(result).toBe('未找到该资源')
    expectNoWriteNoSideEffects()
  })

  it('隐藏复检对管理员同样生效', async () => {
    resourceFindUniqueMock.mockResolvedValue(buildSnapshot())
    transactionQueryRawMock.mockResolvedValue([
      { status: 1, section: 'galgame' }
    ])

    const result = await updatePatchResource(buildInput(), 9, 3)

    expect(result).toBe('未找到该资源')
    expect(transactionResourceUpdateMock).not.toHaveBeenCalled()
  })

  it('快照公开但锁下已转待审核, 非特权作者被拒', async () => {
    resourceFindUniqueMock.mockResolvedValue(buildSnapshot())
    transactionQueryRawMock.mockResolvedValue([
      { status: 3, section: 'galgame' }
    ])

    const result = await updatePatchResource(buildInput(), 7, 1)

    expect(result).toBe('您发布的资源正在审核中, 暂时无法修改')
    expectNoWriteNoSideEffects()
  })

  it('锁下待审核不拦管理员, 保持事务外守卫语义', async () => {
    resourceFindUniqueMock.mockResolvedValue(buildSnapshot())
    transactionQueryRawMock.mockResolvedValue([
      { status: 3, section: 'galgame' }
    ])
    transactionResourceUpdateMock.mockResolvedValue(buildUpdated({ status: 3 }))

    const result = await updatePatchResource(buildInput(), 9, 3)

    expect(typeof result).not.toBe('string')
    expect(transactionResourceUpdateMock).toHaveBeenCalledTimes(1)
  })

  it('快照公开但锁下已转人工审批, 非特权作者被拒', async () => {
    resourceFindUniqueMock.mockResolvedValue(buildSnapshot())
    transactionQueryRawMock.mockResolvedValue([
      { status: 2, section: 'galgame' }
    ])

    const result = await updatePatchResource(buildInput(), 7, 1)

    expect(result).toBe('您发布的资源正在等待管理员审核, 暂时无法修改')
    expectNoWriteNoSideEffects()
  })

  it('行在窗口期被删除时返回业务错误而非抛 P2025', async () => {
    resourceFindUniqueMock.mockResolvedValue(buildSnapshot())
    transactionQueryRawMock.mockResolvedValue([])

    const result = await updatePatchResource(buildInput(), 7, 1)

    expect(result).toBe('未找到该资源')
    expectNoWriteNoSideEffects()
  })
})
