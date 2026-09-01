import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  findFirstMock,
  findUniqueMock,
  updateMock,
  relationFindManyMock,
  transactionMock,
  invalidateMock,
  enqueueBatchMock,
  kickDrainMock,
  tx
} = vi.hoisted(() => {
  const updateMock = vi.fn()
  const relationFindManyMock = vi.fn()
  return {
    findFirstMock: vi.fn(),
    findUniqueMock: vi.fn(),
    updateMock,
    relationFindManyMock,
    transactionMock: vi.fn(),
    invalidateMock: vi.fn(),
    enqueueBatchMock: vi.fn(),
    kickDrainMock: vi.fn(),
    tx: {
      patch_tag: { update: updateMock },
      patch_tag_relation: { findMany: relationFindManyMock }
    }
  }
})

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_tag: {
      findFirst: findFirstMock,
      findUnique: findUniqueMock
    },
    $transaction: transactionMock
  }
}))

vi.mock('~/app/api/tag/cache', () => ({
  invalidateTagListCache: invalidateMock
}))

vi.mock('~/server/search/sync', () => ({
  enqueueSearchOutboxBatch: enqueueBatchMock,
  kickSearchOutboxDrain: kickDrainMock
}))

import { updateTag } from '~/app/api/tag/update'

const INPUT = { tagId: 1, name: 'ADV', introduction: '', alias: ['AVG'] }
const TAG = { id: 1, name: 'ADV', count: 0, alias: ['AVG'] }

describe('updateTag 搜索索引同步', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    findFirstMock.mockResolvedValue(null)
    findUniqueMock.mockResolvedValue({ name: 'AVG-old' })
    updateMock.mockResolvedValue(TAG)
    relationFindManyMock.mockResolvedValue([{ patch_id: 11 }, { patch_id: 12 }])
    transactionMock.mockImplementation(async (fn) => fn(tx))
    invalidateMock.mockResolvedValue(undefined)
    enqueueBatchMock.mockResolvedValue(undefined)
  })

  it('改名时在事务内为全部关联 patch 入队，提交后 kick', async () => {
    await expect(updateTag(INPUT)).resolves.toEqual(TAG)

    expect(relationFindManyMock).toHaveBeenCalledWith({
      where: { tag_id: 1 },
      select: { patch_id: true }
    })
    // 入队作用在事务 tx 上，与标签变更原子提交
    expect(enqueueBatchMock).toHaveBeenCalledWith(tx, [11, 12])
    expect(kickDrainMock).toHaveBeenCalledTimes(1)
    expect(invalidateMock).toHaveBeenCalledTimes(1)
  })

  it('仅改简介/别名（name 未变）不查关系、入队空数组、不 kick', async () => {
    findUniqueMock.mockResolvedValue({ name: 'ADV' })

    await expect(updateTag(INPUT)).resolves.toEqual(TAG)

    expect(relationFindManyMock).not.toHaveBeenCalled()
    expect(enqueueBatchMock).toHaveBeenCalledWith(tx, [])
    expect(kickDrainMock).not.toHaveBeenCalled()
  })

  it('重名冲突时返回错误、不更新、不入队', async () => {
    findFirstMock.mockResolvedValue({ ...TAG, id: 2 })

    await expect(updateTag(INPUT)).resolves.toBe('这个标签已经存在了')

    expect(updateMock).not.toHaveBeenCalled()
    expect(enqueueBatchMock).not.toHaveBeenCalled()
    expect(kickDrainMock).not.toHaveBeenCalled()
  })
})
