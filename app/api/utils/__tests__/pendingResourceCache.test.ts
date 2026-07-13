import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getKvMock, setKvMock, delKvMock, resourceCountMock } = vi.hoisted(
  () => ({
    getKvMock: vi.fn(),
    setKvMock: vi.fn(),
    delKvMock: vi.fn(),
    resourceCountMock: vi.fn()
  })
)

vi.mock('~/lib/redis', () => ({
  getKv: getKvMock,
  setKv: setKvMock,
  delKv: delKvMock
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_resource: { count: resourceCountMock }
  }
}))

import {
  hasPendingResource,
  invalidateUserPendingResourceCache
} from '~/app/api/utils/pendingResourceCache'

const CACHE_KEY = 'user:has-pending-resource:7'

describe('hasPendingResource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setKvMock.mockResolvedValue(undefined)
  })

  it('returns cached false without querying the db', async () => {
    getKvMock.mockResolvedValue('0')

    const result = await hasPendingResource(7)

    expect(result).toBe(false)
    expect(resourceCountMock).not.toHaveBeenCalled()
    expect(setKvMock).not.toHaveBeenCalled()
  })

  it('returns cached true without querying the db', async () => {
    getKvMock.mockResolvedValue('1')

    const result = await hasPendingResource(7)

    expect(result).toBe(true)
    expect(resourceCountMock).not.toHaveBeenCalled()
  })

  it('queries the db and caches false on cache miss', async () => {
    getKvMock.mockResolvedValue(null)
    resourceCountMock.mockResolvedValue(0)

    const result = await hasPendingResource(7)

    expect(result).toBe(false)
    expect(resourceCountMock).toHaveBeenCalledWith({
      where: { user_id: 7, status: { in: [2, 3] } }
    })
    expect(setKvMock).toHaveBeenCalledWith(CACHE_KEY, '0', 60)
  })

  it('caches true when a pending resource exists', async () => {
    getKvMock.mockResolvedValue(null)
    resourceCountMock.mockResolvedValue(2)

    const result = await hasPendingResource(7)

    expect(result).toBe(true)
    expect(setKvMock).toHaveBeenCalledWith(CACHE_KEY, '1', 60)
  })

  it('falls back to the db when redis read fails', async () => {
    getKvMock.mockRejectedValue(new Error('redis down'))
    resourceCountMock.mockResolvedValue(1)

    const result = await hasPendingResource(7)

    expect(result).toBe(true)
    expect(resourceCountMock).toHaveBeenCalledTimes(1)
  })
})

describe('invalidateUserPendingResourceCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes the per-user cache key', async () => {
    delKvMock.mockResolvedValue(undefined)

    await invalidateUserPendingResourceCache(7)

    expect(delKvMock).toHaveBeenCalledWith(CACHE_KEY)
  })

  it('swallows redis errors', async () => {
    delKvMock.mockRejectedValue(new Error('redis down'))

    await expect(invalidateUserPendingResourceCache(7)).resolves.toBeUndefined()
  })
})
