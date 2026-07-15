import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findManyMock, delKvMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  delKvMock: vi.fn(async () => undefined)
}))

vi.mock('~/lib/redis', () => ({
  delKv: delKvMock,
  delKvs: vi.fn(),
  getKv: vi.fn(),
  getKvs: vi.fn(),
  setKv: vi.fn()
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch: { findMany: findManyMock }
  }
}))

import {
  getPatchCacheKey,
  getPatchIntroductionCacheKey,
  invalidatePatchContentCacheByPatchId
} from '~/app/api/patch/cache'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('invalidatePatchContentCacheByPatchId', () => {
  it('按 patch_id 解析 unique_id 并失效详情缓存两键', async () => {
    findManyMock.mockResolvedValue([{ unique_id: 'aaaaaaaa' }])

    await invalidatePatchContentCacheByPatchId(7)

    expect(findManyMock).toHaveBeenCalledWith({
      where: { id: { in: [7] } },
      select: { unique_id: true }
    })
    expect(delKvMock).toHaveBeenCalledWith(getPatchCacheKey('aaaaaaaa'))
    expect(delKvMock).toHaveBeenCalledWith(
      getPatchIntroductionCacheKey('aaaaaaaa')
    )
  })

  it('批量入参先去重再查询, 命中的每个 patch 都失效', async () => {
    findManyMock.mockResolvedValue([
      { unique_id: 'aaaaaaaa' },
      { unique_id: 'bbbbbbbb' }
    ])

    await invalidatePatchContentCacheByPatchId([10, 10, 20])

    expect(findManyMock).toHaveBeenCalledWith({
      where: { id: { in: [10, 20] } },
      select: { unique_id: true }
    })
    expect(delKvMock).toHaveBeenCalledWith(getPatchCacheKey('aaaaaaaa'))
    expect(delKvMock).toHaveBeenCalledWith(getPatchCacheKey('bbbbbbbb'))
  })

  it('空数组短路返回, 不查询数据库也不删缓存', async () => {
    await invalidatePatchContentCacheByPatchId([])

    expect(findManyMock).not.toHaveBeenCalled()
    expect(delKvMock).not.toHaveBeenCalled()
  })
})
