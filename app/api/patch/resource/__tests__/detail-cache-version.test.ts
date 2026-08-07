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

  // 版本键无 TTL 会在 volatile-lfu 下无界积累; 过期/驱逐的安全性由读侧铸造承担
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
    setKvIfAbsentMock.mockImplementation(async (key: string, value: string) => {
      if (versions.has(key)) {
        return false
      }
      versions.set(key, value)
      return true
    })

    const keyABefore = await getPatchResourceDetailCacheKey(10)
    const keyBBefore = await getPatchResourceDetailCacheKey(11)

    await invalidatePatchResourceDetailCache(10)

    expect(await getPatchResourceDetailCacheKey(10)).not.toBe(keyABefore)
    expect(await getPatchResourceDetailCacheKey(11)).toBe(keyBBefore)
  })

  // 核心回归: 版本键属 volatile-lfu 可驱逐集合, 失效后被驱逐时读者不得映射回
  // 失效前仍存活的旧命名空间 (已隐藏/已删资源复活)
  it('失效后版本键被驱逐, 新键不复用驱逐前的任何键', async () => {
    const versions = new Map<string, string>()
    getKvMock.mockImplementation(
      async (key: string) => versions.get(key) ?? null
    )
    setKvMock.mockImplementation(async (key: string, value: string) => {
      versions.set(key, value)
    })
    setKvIfAbsentMock.mockImplementation(async (key: string, value: string) => {
      if (versions.has(key)) {
        return false
      }
      versions.set(key, value)
      return true
    })

    const keyBefore = await getPatchResourceDetailCacheKey(10)
    await invalidatePatchResourceDetailCache(10)
    versions.delete(versionKey(10))

    expect(await getPatchResourceDetailCacheKey(10)).not.toBe(keyBefore)
  })

  it('版本键 miss 时以 NX 铸造带 TTL 的新版本', async () => {
    getKvMock.mockResolvedValue(null)
    setKvIfAbsentMock.mockResolvedValue(true)

    expect(await getPatchResourceDetailCacheKey(10)).not.toBeNull()
    expect(setKvIfAbsentMock).toHaveBeenCalledWith(
      versionKey(10),
      expect.any(String),
      PATCH_RESOURCE_DETAIL_VERSION_DURATION
    )
  })

  it('并发铸造落败时重读采信胜者版本', async () => {
    getKvMock.mockResolvedValue('winner')
    getKvMock.mockResolvedValueOnce(null)
    setKvIfAbsentMock.mockResolvedValue(false)

    const contended = await getPatchResourceDetailCacheKey(10)
    const settled = await getPatchResourceDetailCacheKey(10)

    expect(contended).toBe(settled)
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
