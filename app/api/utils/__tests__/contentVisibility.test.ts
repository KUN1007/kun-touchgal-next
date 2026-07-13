import { beforeEach, describe, expect, it, vi } from 'vitest'

const { hasPendingResourceMock } = vi.hoisted(() => ({
  hasPendingResourceMock: vi.fn()
}))

vi.mock('~/app/api/utils/pendingResourceCache', () => ({
  hasPendingResource: hasPendingResourceMock
}))

import { shouldBypassSharedCache } from '~/app/api/utils/contentVisibility'

describe('shouldBypassSharedCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false for anonymous without checking pending resources', async () => {
    const result = await shouldBypassSharedCache(null)

    expect(result).toBe(false)
    expect(hasPendingResourceMock).not.toHaveBeenCalled()
  })

  it('returns true for admin without checking pending resources', async () => {
    const result = await shouldBypassSharedCache({ uid: 7, role: 3 })

    expect(result).toBe(true)
    expect(hasPendingResourceMock).not.toHaveBeenCalled()
  })

  it('delegates to hasPendingResource for authenticated non-admins', async () => {
    hasPendingResourceMock.mockResolvedValue(true)

    const result = await shouldBypassSharedCache({ uid: 7, role: 1 })

    expect(result).toBe(true)
    expect(hasPendingResourceMock).toHaveBeenCalledWith(7)
  })

  it('does not bypass when the author has no pending resource', async () => {
    hasPendingResourceMock.mockResolvedValue(false)

    const result = await shouldBypassSharedCache({ uid: 7, role: 1 })

    expect(result).toBe(false)
    expect(hasPendingResourceMock).toHaveBeenCalledWith(7)
  })
})
