import { beforeEach, describe, expect, it, vi } from 'vitest'

const { tagFindManyMock, companyFindManyMock } = vi.hoisted(() => ({
  tagFindManyMock: vi.fn(),
  companyFindManyMock: vi.fn()
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_tag: { findMany: tagFindManyMock },
    patch_company: { findMany: companyFindManyMock }
  }
}))

import {
  resolveCompanyIdsByNames,
  resolveTagIdsByNames
} from '~/server/search/resolve'

describe('resolveTagIdsByNames', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips the query and returns an empty map for no names', async () => {
    const map = await resolveTagIdsByNames([])
    expect(map.size).toBe(0)
    expect(tagFindManyMock).not.toHaveBeenCalled()
  })

  it('groups ids by matched name and alias', async () => {
    tagFindManyMock.mockResolvedValue([
      { id: 1, name: '恋爱', alias: [] },
      { id: 2, name: 'love', alias: ['恋爱'] }
    ])

    const map = await resolveTagIdsByNames(['恋爱'])

    expect(map.get('恋爱')).toEqual([1, 2])
  })

  it('distributes one query row across the correct name buckets only', async () => {
    tagFindManyMock.mockResolvedValue([
      { id: 1, name: '恋爱', alias: [] },
      { id: 2, name: 'love', alias: ['恋爱'] }
    ])

    const map = await resolveTagIdsByNames(['恋爱', 'love'])

    expect(map.get('恋爱')).toEqual([1, 2])
    expect(map.get('love')).toEqual([2])
  })

  it('dedupes when a row matches by both name and alias', async () => {
    tagFindManyMock.mockResolvedValue([
      { id: 5, name: '日常', alias: ['日常'] }
    ])

    const map = await resolveTagIdsByNames(['日常'])

    expect(map.get('日常')).toEqual([5])
  })

  it('dedupes repeated names into a single query', async () => {
    tagFindManyMock.mockResolvedValue([{ id: 9, name: 'x', alias: [] }])

    await resolveTagIdsByNames(['x', 'x'])

    expect(tagFindManyMock).toHaveBeenCalledTimes(1)
    expect(tagFindManyMock.mock.calls[0][0].where).toEqual({
      OR: [{ name: { in: ['x'] } }, { alias: { hasSome: ['x'] } }]
    })
  })
})

describe('resolveCompanyIdsByNames', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips the query and returns an empty map for no names', async () => {
    const map = await resolveCompanyIdsByNames([])
    expect(map.size).toBe(0)
    expect(companyFindManyMock).not.toHaveBeenCalled()
  })

  it('matches name, alias and parent_brand', async () => {
    companyFindManyMock.mockResolvedValue([
      { id: 10, name: 'Key', alias: [], parent_brand: [] },
      { id: 11, name: 'VisualArts', alias: [], parent_brand: ['Key'] }
    ])

    const map = await resolveCompanyIdsByNames(['Key'])

    expect(map.get('Key')).toEqual([10, 11])
  })
})
