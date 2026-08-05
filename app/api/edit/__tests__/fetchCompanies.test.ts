import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  fetchVndbVnMock,
  companyFindManyMock,
  companyCreateManyMock,
  relationCreateManyMock,
  invalidateCompanyCacheMock
} = vi.hoisted(() => ({
  fetchVndbVnMock: vi.fn(),
  companyFindManyMock: vi.fn(),
  companyCreateManyMock: vi.fn(),
  relationCreateManyMock: vi.fn(),
  invalidateCompanyCacheMock: vi.fn()
}))

vi.mock('~/lib/arnebiae/vndb', () => ({
  fetchVndbVn: fetchVndbVnMock
}))

vi.mock('~/app/api/company/cache', () => ({
  invalidateCompanyListCache: invalidateCompanyCacheMock
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_company: {
      findMany: companyFindManyMock,
      createMany: companyCreateManyMock
    },
    patch_company_relation: {
      createMany: relationCreateManyMock
    }
  }
}))

import { ensurePatchCompaniesFromVNDB } from '~/app/api/edit/fetchCompanies'

const VNDB_RESPONSE = {
  results: [
    {
      developers: [
        {
          id: 'p1',
          name: 'Key',
          original: null,
          aliases: [],
          lang: 'ja',
          type: 'co',
          description: null,
          extlinks: []
        }
      ]
    }
  ]
}

describe('ensurePatchCompaniesFromVNDB cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchVndbVnMock.mockResolvedValue(VNDB_RESPONSE)
    companyFindManyMock.mockResolvedValue([])
    companyCreateManyMock.mockResolvedValue({ count: 1 })
    relationCreateManyMock.mockResolvedValue({ count: 1 })
    invalidateCompanyCacheMock.mockResolvedValue(undefined)
  })

  it('does not invalidate when the first database read fails', async () => {
    companyFindManyMock.mockRejectedValueOnce(new Error('database down'))

    await expect(ensurePatchCompaniesFromVNDB(1, 'v1', 7)).resolves.toEqual({
      ensured: 0,
      related: 0
    })

    expect(companyCreateManyMock).not.toHaveBeenCalled()
    expect(invalidateCompanyCacheMock).not.toHaveBeenCalled()
  })

  it('invalidates after a successful creation even when the reread fails', async () => {
    const events: string[] = []
    companyFindManyMock
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('database down'))
    companyCreateManyMock.mockImplementation(async () => {
      events.push('create-company')
      return { count: 1 }
    })
    invalidateCompanyCacheMock.mockImplementation(async () => {
      events.push('invalidate-company-cache')
    })

    await expect(ensurePatchCompaniesFromVNDB(1, 'v1', 7)).resolves.toEqual({
      ensured: 0,
      related: 0
    })

    expect(events).toEqual(['create-company', 'invalidate-company-cache'])
  })

  it('does not invalidate when nothing was inserted', async () => {
    companyFindManyMock
      .mockResolvedValueOnce([{ id: 5, name: 'Key' }])
      .mockResolvedValueOnce([{ id: 5 }])
    relationCreateManyMock.mockResolvedValueOnce({ count: 0 })

    await expect(ensurePatchCompaniesFromVNDB(1, 'v1', 7)).resolves.toEqual({
      ensured: 0,
      related: 1
    })

    expect(companyCreateManyMock).not.toHaveBeenCalled()
    expect(invalidateCompanyCacheMock).not.toHaveBeenCalled()
  })

  it('invalidates when a relation is actually inserted', async () => {
    companyFindManyMock
      .mockResolvedValueOnce([{ id: 5, name: 'Key' }])
      .mockResolvedValueOnce([{ id: 5 }])
    relationCreateManyMock.mockResolvedValueOnce({ count: 1 })

    await expect(ensurePatchCompaniesFromVNDB(1, 'v1', 7)).resolves.toEqual({
      ensured: 0,
      related: 1
    })

    expect(companyCreateManyMock).not.toHaveBeenCalled()
    expect(invalidateCompanyCacheMock).toHaveBeenCalledTimes(1)
  })
})
