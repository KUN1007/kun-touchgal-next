import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getKvMock,
  getKvsMock,
  setKvMock,
  setKvIfAbsentMock,
  delKvMock,
  acquireKvLockMock,
  releaseKvLockMock,
  resourceFindManyMock,
  resourceCountMock
} = vi.hoisted(() => ({
  getKvMock: vi.fn(),
  getKvsMock: vi.fn(),
  setKvMock: vi.fn(),
  setKvIfAbsentMock: vi.fn(),
  delKvMock: vi.fn(),
  acquireKvLockMock: vi.fn(),
  releaseKvLockMock: vi.fn(),
  resourceFindManyMock: vi.fn(),
  resourceCountMock: vi.fn()
}))

vi.mock('~/lib/redis', () => ({
  getKv: getKvMock,
  getKvs: getKvsMock,
  setKv: setKvMock,
  setKvIfAbsent: setKvIfAbsentMock,
  delKv: delKvMock,
  acquireKvLock: acquireKvLockMock,
  releaseKvLock: releaseKvLockMock
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_resource: {
      findMany: resourceFindManyMock,
      count: resourceCountMock
    }
  }
}))

import { getPatchResource } from '~/app/api/resource/service'

const blockedTagWhere = (count: number) => ({
  NOT: {
    tag: {
      some: {
        tag_id: { in: Array.from({ length: count }, (_, index) => index + 1) }
      }
    }
  }
})

const INPUT = {
  sortField: 'created',
  sortOrder: 'desc',
  page: 1,
  limit: 20
} as const

const EMPTY_RESPONSE = { resources: [], total: 0 }
const CACHED_RESPONSE = { resources: [{ id: 1 }], total: 1 }

const getRequestedCacheKey = () => getKvMock.mock.calls[0][0] as string

describe('getPatchResource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getKvsMock.mockResolvedValue([null, null])
    resourceFindManyMock.mockResolvedValue([])
    resourceCountMock.mockResolvedValue(0)
    setKvMock.mockResolvedValue(undefined)
    setKvIfAbsentMock.mockResolvedValue(true)
    releaseKvLockMock.mockResolvedValue(undefined)
  })

  it('skips the shared cache entirely when any tag is blocked', async () => {
    const response = await getPatchResource(
      INPUT,
      blockedTagWhere(1),
      null,
      false
    )

    expect(response).toEqual(EMPTY_RESPONSE)
    expect(resourceFindManyMock).toHaveBeenCalledTimes(1)
    // 连缓存版本号都不再读取
    expect(getKvsMock).not.toHaveBeenCalled()
    expect(getKvMock).not.toHaveBeenCalled()
    expect(acquireKvLockMock).not.toHaveBeenCalled()
    expect(setKvMock).not.toHaveBeenCalled()
  })

  it('skips the shared cache for large blocked tag sets too', async () => {
    const response = await getPatchResource(
      INPUT,
      blockedTagWhere(60),
      null,
      false
    )

    expect(response).toEqual(EMPTY_RESPONSE)
    expect(resourceFindManyMock).toHaveBeenCalledTimes(1)
    expect(getKvsMock).not.toHaveBeenCalled()
    expect(getKvMock).not.toHaveBeenCalled()
    expect(setKvMock).not.toHaveBeenCalled()
  })

  it('returns cached response without querying or locking', async () => {
    getKvMock.mockResolvedValue(JSON.stringify(CACHED_RESPONSE))

    const response = await getPatchResource(INPUT, {}, null, false)

    expect(response).toEqual(CACHED_RESPONSE)
    expect(acquireKvLockMock).not.toHaveBeenCalled()
    expect(resourceFindManyMock).not.toHaveBeenCalled()
  })

  it('queries once and writes cache when the lock is acquired on miss', async () => {
    getKvMock.mockResolvedValue(null)
    acquireKvLockMock.mockResolvedValue('token-1')

    const response = await getPatchResource(INPUT, {}, null, false)

    const cacheKey = getRequestedCacheKey()
    expect(response).toEqual(EMPTY_RESPONSE)
    expect(acquireKvLockMock).toHaveBeenCalledWith(`${cacheKey}:lock`, 10)
    expect(resourceFindManyMock).toHaveBeenCalledTimes(1)
    expect(resourceCountMock).toHaveBeenCalledTimes(1)
    expect(setKvMock).toHaveBeenCalledWith(
      cacheKey,
      JSON.stringify(response),
      60
    )
    expect(releaseKvLockMock).toHaveBeenCalledWith(
      `${cacheKey}:lock`,
      'token-1'
    )
  })

  it('waits and returns the cache written by the lock holder', async () => {
    getKvMock
      .mockResolvedValueOnce(null)
      .mockResolvedValue(JSON.stringify(CACHED_RESPONSE))
    acquireKvLockMock.mockResolvedValue(null)

    const response = await getPatchResource(INPUT, {}, null, false)

    expect(response).toEqual(CACHED_RESPONSE)
    expect(resourceFindManyMock).not.toHaveBeenCalled()
    expect(setKvMock).not.toHaveBeenCalled()
    expect(setKvIfAbsentMock).not.toHaveBeenCalled()
  })

  it('falls back to the database and heals the cache when the wait times out', async () => {
    getKvMock.mockResolvedValue(null)
    acquireKvLockMock.mockResolvedValue(null)

    const response = await getPatchResource(INPUT, {}, null, false)

    expect(response).toEqual(EMPTY_RESPONSE)
    expect(getKvMock).toHaveBeenCalledTimes(4)
    expect(resourceFindManyMock).toHaveBeenCalledTimes(1)
    expect(setKvMock).not.toHaveBeenCalled()
    expect(setKvIfAbsentMock).toHaveBeenCalledWith(
      getRequestedCacheKey(),
      JSON.stringify(response),
      60
    )
    expect(releaseKvLockMock).not.toHaveBeenCalled()
  })

  it('bypasses cache and singleflight for personalized viewers', async () => {
    const response = await getPatchResource(
      INPUT,
      {},
      { uid: 1, role: 3 },
      true
    )

    expect(response).toEqual(EMPTY_RESPONSE)
    expect(getKvsMock).not.toHaveBeenCalled()
    expect(getKvMock).not.toHaveBeenCalled()
    expect(acquireKvLockMock).not.toHaveBeenCalled()
    expect(setKvMock).not.toHaveBeenCalled()
    expect(resourceFindManyMock).toHaveBeenCalledTimes(1)
    expect(resourceFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: [0, 2, 3] } })
      })
    )
  })

  it('skips singleflight when the cache version read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getKvsMock.mockRejectedValue(new Error('redis down'))

    const response = await getPatchResource(INPUT, {}, null, false)

    expect(response).toEqual(EMPTY_RESPONSE)
    expect(getKvMock).not.toHaveBeenCalled()
    expect(acquireKvLockMock).not.toHaveBeenCalled()
    expect(resourceFindManyMock).toHaveBeenCalledTimes(1)
    expect(setKvMock).not.toHaveBeenCalled()
  })

  it('queries directly without locking when the cache read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getKvMock.mockRejectedValue(new Error('redis down'))

    const response = await getPatchResource(INPUT, {}, null, false)

    expect(response).toEqual(EMPTY_RESPONSE)
    expect(acquireKvLockMock).not.toHaveBeenCalled()
    expect(resourceFindManyMock).toHaveBeenCalledTimes(1)
    expect(setKvMock).not.toHaveBeenCalled()
  })
})
