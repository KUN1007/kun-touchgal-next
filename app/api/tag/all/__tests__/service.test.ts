import { describe, expect, it, vi } from 'vitest'

const { findManyMock, countMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  countMock: vi.fn()
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_tag: {
      findMany: findManyMock,
      count: countMock
    }
  }
}))

import { getTag } from '~/app/api/tag/all/service'

describe('getTag', () => {
  it('selects only the fields exposed by the tag list response', async () => {
    findManyMock.mockResolvedValue([
      { id: 1, name: 'ADV', count: 7, alias: ['AVG'] }
    ])
    countMock.mockResolvedValue(1)

    await getTag({ page: 2, limit: 100 }, [8, 9])

    expect(findManyMock).toHaveBeenCalledWith({
      where: { id: { notIn: [8, 9] } },
      take: 100,
      skip: 100,
      orderBy: { count: 'desc' },
      select: {
        id: true,
        name: true,
        count: true,
        alias: true
      }
    })
  })
})
