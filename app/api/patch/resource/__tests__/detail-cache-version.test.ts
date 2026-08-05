import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getKvMock, getKvsMock, setKvMock, setKvIfAbsentMock, delKvMock } =
  vi.hoisted(() => ({
    getKvMock: vi.fn(),
    getKvsMock: vi.fn(),
    setKvMock: vi.fn(),
    setKvIfAbsentMock: vi.fn(),
    delKvMock: vi.fn()
  }))

vi.mock('~/lib/redis', () => ({
  getKv: getKvMock,
  getKvs: getKvsMock,
  setKv: setKvMock,
  setKvIfAbsent: setKvIfAbsentMock,
  delKv: delKvMock
}))

import {
  getPatchResourceDetailCacheKey,
  invalidatePatchResourceDetailCache
} from '~/app/api/patch/resource/cache'
import {
  RESOURCE_LIST_CACHE_CONTENT_VERSION_KEY,
  RESOURCE_LIST_CACHE_STATS_VERSION_KEY
} from '~/app/api/resource/cache'

const DETAIL_CONTENT_VERSION_KEY = 'patch:resource:detail:version:content'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('patch 资源详情缓存版本号', () => {
  it('内容版本号自持, 不再读资源列表的内容版本号', async () => {
    getKvsMock.mockResolvedValue(['content', 'stats'])

    await getPatchResourceDetailCacheKey(10)

    const readKeys = getKvsMock.mock.calls[0][0]
    expect(readKeys).toContain(DETAIL_CONTENT_VERSION_KEY)
    expect(readKeys).not.toContain(RESOURCE_LIST_CACHE_CONTENT_VERSION_KEY)
  })

  // 点赞/下载两处写路径无 section 闸门, 统计维度继续复用列表的版本号
  it('统计版本号仍复用资源列表的', async () => {
    getKvsMock.mockResolvedValue(['content', 'stats'])

    await getPatchResourceDetailCacheKey(10)

    expect(getKvsMock.mock.calls[0][0]).toContain(
      RESOURCE_LIST_CACHE_STATS_VERSION_KEY
    )
  })

  it('失效只写自持的内容版本键', async () => {
    await invalidatePatchResourceDetailCache()

    expect(setKvMock).toHaveBeenCalledTimes(1)
    expect(setKvMock.mock.calls[0][0]).toBe(DETAIL_CONTENT_VERSION_KEY)
    expect(setKvMock.mock.calls[0][1]).toEqual(expect.any(String))
  })

  it('内容版本号一变缓存键即变', async () => {
    getKvsMock.mockResolvedValueOnce(['v1', 'stats'])
    const before = await getPatchResourceDetailCacheKey(10)
    getKvsMock.mockResolvedValueOnce(['v2', 'stats'])
    const after = await getPatchResourceDetailCacheKey(10)

    expect(before).not.toBeNull()
    expect(after).not.toBe(before)
  })

  it('统计版本号一变缓存键即变', async () => {
    getKvsMock.mockResolvedValueOnce(['content', 's1'])
    const before = await getPatchResourceDetailCacheKey(10)
    getKvsMock.mockResolvedValueOnce(['content', 's2'])
    const after = await getPatchResourceDetailCacheKey(10)

    expect(after).not.toBe(before)
  })

  it('同版本号下不同 patch 的键互不相同', async () => {
    getKvsMock.mockResolvedValue(['content', 'stats'])

    expect(await getPatchResourceDetailCacheKey(10)).not.toBe(
      await getPatchResourceDetailCacheKey(11)
    )
  })

  it('版本号读取失败返回 null 而非退回固定键', async () => {
    getKvsMock.mockRejectedValue(new Error('redis down'))

    expect(await getPatchResourceDetailCacheKey(10)).toBeNull()
  })

  it('失效时 Redis 故障不上抛', async () => {
    setKvMock.mockRejectedValue(new Error('redis down'))

    await expect(invalidatePatchResourceDetailCache()).resolves.toBeUndefined()
  })
})
