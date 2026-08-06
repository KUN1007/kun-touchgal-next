import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getKvMock, setKvMock, setKvIfAbsentMock, delKvMock } = vi.hoisted(
  () => ({
    getKvMock: vi.fn(),
    setKvMock: vi.fn(),
    setKvIfAbsentMock: vi.fn(),
    delKvMock: vi.fn()
  })
)

vi.mock('~/lib/redis', () => ({
  getKv: getKvMock,
  setKv: setKvMock,
  setKvIfAbsent: setKvIfAbsentMock,
  delKv: delKvMock
}))

import {
  getPatchResourceDetailCacheKey,
  invalidatePatchResourceDetailCache
} from '~/app/api/patch/resource/cache'
import { PATCH_RESOURCE_DETAIL_VERSION_DURATION } from '~/config/cache'

const versionKey = (patchId: number) =>
  `patch:resource:detail:version:${patchId}`

beforeEach(() => {
  vi.resetAllMocks()
})

describe('patch 资源详情缓存版本号', () => {
  it('版本键按 patch 分片, 不读任何全局版本键', async () => {
    getKvMock.mockResolvedValue('v1')

    await getPatchResourceDetailCacheKey(10)

    expect(getKvMock).toHaveBeenCalledTimes(1)
    expect(getKvMock).toHaveBeenCalledWith(versionKey(10))
  })

  // 版本键无 TTL 会在 volatile-lfu 下无界积累; TTL 远大于缓存 TTL 故过期不脏读
  it('失效只写该 patch 的分片版本键且带 TTL', async () => {
    await invalidatePatchResourceDetailCache(10)

    expect(setKvMock).toHaveBeenCalledTimes(1)
    expect(setKvMock).toHaveBeenCalledWith(
      versionKey(10),
      expect.any(String),
      PATCH_RESOURCE_DETAIL_VERSION_DURATION
    )
  })

  // 核心回归: 失效信号与缓存键同粒度, A 补丁的写入不冲掉 B 补丁的缓存
  it('失效 A 补丁后 A 的键变而 B 的键不变', async () => {
    const versions = new Map<string, string>()
    getKvMock.mockImplementation(
      async (key: string) => versions.get(key) ?? null
    )
    setKvMock.mockImplementation(async (key: string, value: string) => {
      versions.set(key, value)
    })

    const keyABefore = await getPatchResourceDetailCacheKey(10)
    const keyBBefore = await getPatchResourceDetailCacheKey(11)

    await invalidatePatchResourceDetailCache(10)

    expect(await getPatchResourceDetailCacheKey(10)).not.toBe(keyABefore)
    expect(await getPatchResourceDetailCacheKey(11)).toBe(keyBBefore)
  })

  it('版本号一变缓存键即变', async () => {
    getKvMock.mockResolvedValueOnce('v1')
    const before = await getPatchResourceDetailCacheKey(10)
    getKvMock.mockResolvedValueOnce('v2')
    const after = await getPatchResourceDetailCacheKey(10)

    expect(before).not.toBeNull()
    expect(after).not.toBe(before)
  })

  it('同版本号下不同 patch 的键互不相同', async () => {
    getKvMock.mockResolvedValue('v1')

    expect(await getPatchResourceDetailCacheKey(10)).not.toBe(
      await getPatchResourceDetailCacheKey(11)
    )
  })

  it('版本号读取失败返回 null 而非退回固定键', async () => {
    getKvMock.mockRejectedValue(new Error('redis down'))

    expect(await getPatchResourceDetailCacheKey(10)).toBeNull()
  })

  it('失效时 Redis 故障不上抛', async () => {
    setKvMock.mockRejectedValue(new Error('redis down'))

    await expect(
      invalidatePatchResourceDetailCache(10)
    ).resolves.toBeUndefined()
  })
})
