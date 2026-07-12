import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handleBatchPatchTagsMock,
  tagFindManyMock,
  tagCreateManyMock,
  tagUpdateManyMock,
  tagRelationFindManyMock,
  tagRelationCreateManyMock,
  companyFindManyMock,
  companyFindFirstMock,
  companyCreateManyMock,
  companyCreateMock,
  companyUpdateManyMock,
  companyUpdateMock,
  companyRelationFindManyMock,
  companyRelationFindFirstMock,
  companyRelationCreateManyMock,
  companyRelationCreateMock,
  aliasFindManyMock,
  aliasCreateManyMock,
  invalidateTagCacheMock,
  invalidateCompanyCacheMock
} = vi.hoisted(() => ({
  handleBatchPatchTagsMock: vi.fn(),
  tagFindManyMock: vi.fn(),
  tagCreateManyMock: vi.fn(),
  tagUpdateManyMock: vi.fn(),
  tagRelationFindManyMock: vi.fn(),
  tagRelationCreateManyMock: vi.fn(),
  companyFindManyMock: vi.fn(),
  companyFindFirstMock: vi.fn(),
  companyCreateManyMock: vi.fn(),
  companyCreateMock: vi.fn(),
  companyUpdateManyMock: vi.fn(),
  companyUpdateMock: vi.fn(),
  companyRelationFindManyMock: vi.fn(),
  companyRelationFindFirstMock: vi.fn(),
  companyRelationCreateManyMock: vi.fn(),
  companyRelationCreateMock: vi.fn(),
  aliasFindManyMock: vi.fn(),
  aliasCreateManyMock: vi.fn(),
  invalidateTagCacheMock: vi.fn(),
  invalidateCompanyCacheMock: vi.fn()
}))

vi.mock('~/app/api/edit/batchTag', () => ({
  handleBatchPatchTags: handleBatchPatchTagsMock
}))

vi.mock('~/app/api/tag/cache', () => ({
  invalidateTagListCache: invalidateTagCacheMock
}))

vi.mock('~/app/api/company/cache', () => ({
  invalidateCompanyListCache: invalidateCompanyCacheMock
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_tag: {
      findMany: tagFindManyMock,
      createMany: tagCreateManyMock,
      updateMany: tagUpdateManyMock
    },
    patch_tag_relation: {
      findMany: tagRelationFindManyMock,
      createMany: tagRelationCreateManyMock
    },
    patch_company: {
      findMany: companyFindManyMock,
      findFirst: companyFindFirstMock,
      createMany: companyCreateManyMock,
      create: companyCreateMock,
      updateMany: companyUpdateManyMock,
      update: companyUpdateMock
    },
    patch_company_relation: {
      findMany: companyRelationFindManyMock,
      findFirst: companyRelationFindFirstMock,
      createMany: companyRelationCreateManyMock,
      create: companyRelationCreateMock
    },
    patch_alias: {
      findMany: aliasFindManyMock,
      createMany: aliasCreateManyMock
    }
  }
}))

import { processSubmittedExternalData } from '~/app/api/edit/processExternalData'

const EMPTY_DATA = {
  vndbTags: [],
  vndbDevelopers: [],
  bangumiTags: [],
  bangumiDevelopers: [],
  steamTags: [],
  steamDevelopers: [],
  steamAliases: [],
  dlsiteCircleName: '',
  dlsiteCircleLink: ''
}

describe('processSubmittedExternalData cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handleBatchPatchTagsMock.mockResolvedValue({
      success: true,
      changed: false
    })
    tagFindManyMock.mockResolvedValue([])
    tagCreateManyMock.mockResolvedValue({ count: 1 })
    tagUpdateManyMock.mockResolvedValue({ count: 1 })
    tagRelationFindManyMock.mockResolvedValue([])
    tagRelationCreateManyMock.mockResolvedValue({ count: 1 })
    companyFindManyMock.mockResolvedValue([])
    companyFindFirstMock.mockResolvedValue(null)
    companyCreateManyMock.mockResolvedValue({ count: 1 })
    companyCreateMock.mockResolvedValue({ id: 1 })
    companyUpdateManyMock.mockResolvedValue({ count: 1 })
    companyUpdateMock.mockResolvedValue({ count: 1 })
    companyRelationFindManyMock.mockResolvedValue([])
    companyRelationFindFirstMock.mockResolvedValue(null)
    companyRelationCreateManyMock.mockResolvedValue({ count: 1 })
    companyRelationCreateMock.mockResolvedValue({ id: 1 })
    aliasFindManyMock.mockResolvedValue([])
    aliasCreateManyMock.mockResolvedValue({ count: 1 })
    invalidateTagCacheMock.mockResolvedValue(undefined)
    invalidateCompanyCacheMock.mockResolvedValue(undefined)
  })

  it('keeps valid caches when both tasks fail before their first write', async () => {
    tagFindManyMock.mockRejectedValueOnce(new Error('tag read failed'))
    companyFindManyMock.mockRejectedValueOnce(new Error('company read failed'))

    await processSubmittedExternalData(
      1,
      {
        ...EMPTY_DATA,
        vndbTags: ['ADV'],
        vndbDevelopers: ['Key']
      },
      [],
      7
    )

    expect(tagCreateManyMock).not.toHaveBeenCalled()
    expect(companyCreateManyMock).not.toHaveBeenCalled()
    expect(invalidateTagCacheMock).not.toHaveBeenCalled()
    expect(invalidateCompanyCacheMock).not.toHaveBeenCalled()
  })

  it('invalidates tags when a later step fails after tag creation', async () => {
    tagFindManyMock
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('tag reread failed'))

    await processSubmittedExternalData(
      1,
      { ...EMPTY_DATA, vndbTags: ['ADV'] },
      [],
      7
    )

    expect(tagCreateManyMock).toHaveBeenCalledTimes(1)
    expect(invalidateTagCacheMock).toHaveBeenCalledTimes(1)
    expect(invalidateCompanyCacheMock).not.toHaveBeenCalled()
  })

  it('invalidates companies when a later step fails after company creation', async () => {
    companyFindManyMock
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('company reread failed'))

    await processSubmittedExternalData(
      1,
      { ...EMPTY_DATA, vndbDevelopers: ['Key'] },
      [],
      7
    )

    expect(companyCreateManyMock).toHaveBeenCalledTimes(1)
    expect(invalidateCompanyCacheMock).toHaveBeenCalledTimes(1)
    expect(invalidateTagCacheMock).not.toHaveBeenCalled()
  })

  it('coalesces multiple successful company tasks into one invalidation', async () => {
    await processSubmittedExternalData(
      1,
      {
        ...EMPTY_DATA,
        vndbDevelopers: ['Key'],
        bangumiDevelopers: ['AliceSoft'],
        steamDevelopers: ['Navel']
      },
      [],
      7
    )

    expect(companyCreateManyMock).toHaveBeenCalledTimes(3)
    expect(invalidateCompanyCacheMock).toHaveBeenCalledTimes(1)
  })
})
