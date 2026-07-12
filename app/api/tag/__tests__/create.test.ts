import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findFirstMock, createMock, invalidateMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  createMock: vi.fn(),
  invalidateMock: vi.fn()
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_tag: {
      findFirst: findFirstMock,
      create: createMock
    }
  }
}))

vi.mock('~/app/api/tag/cache', () => ({
  invalidateTagListCache: invalidateMock
}))

import { createTag } from '~/app/api/tag/create'

const INPUT = {
  name: 'ADV',
  introduction: '',
  alias: ['AVG']
}
const TAG = { id: 1, name: 'ADV', count: 0, alias: ['AVG'] }

describe('createTag cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findFirstMock.mockResolvedValue(null)
    createMock.mockResolvedValue(TAG)
    invalidateMock.mockResolvedValue(undefined)
  })

  it('invalidates only after the database write succeeds', async () => {
    const events: string[] = []
    createMock.mockImplementation(async () => {
      events.push('database-write')
      return TAG
    })
    invalidateMock.mockImplementation(async () => {
      events.push('cache-invalidation')
    })

    await expect(createTag(INPUT, 7)).resolves.toEqual(TAG)
    expect(events).toEqual(['database-write', 'cache-invalidation'])
  })

  it('does not invalidate when validation finds an existing tag', async () => {
    findFirstMock.mockResolvedValue(TAG)

    await expect(createTag(INPUT, 7)).resolves.toBe('这个标签已经存在了')
    expect(createMock).not.toHaveBeenCalled()
    expect(invalidateMock).not.toHaveBeenCalled()
  })

  it('does not invalidate when the database write fails', async () => {
    createMock.mockRejectedValue(new Error('database down'))

    await expect(createTag(INPUT, 7)).rejects.toThrow('database down')
    expect(invalidateMock).not.toHaveBeenCalled()
  })
})
