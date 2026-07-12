import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  parseGetMock,
  parsePostMock,
  parsePutMock,
  parseDeleteMock,
  verifyHeaderCookieMock,
  findFirstMock,
  createMock,
  updateMock,
  deleteMock,
  invalidateMock
} = vi.hoisted(() => ({
  parseGetMock: vi.fn(),
  parsePostMock: vi.fn(),
  parsePutMock: vi.fn(),
  parseDeleteMock: vi.fn(),
  verifyHeaderCookieMock: vi.fn(),
  findFirstMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  invalidateMock: vi.fn()
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' }
      })
  }
}))

vi.mock('~/app/api/utils/parseQuery', () => ({
  kunParseGetQuery: parseGetMock,
  kunParsePostBody: parsePostMock,
  kunParsePutBody: parsePutMock,
  kunParseDeleteQuery: parseDeleteMock
}))

vi.mock('~/middleware/_verifyHeaderCookie', () => ({
  verifyHeaderCookie: verifyHeaderCookieMock
}))

vi.mock('~/prisma', () => ({
  prisma: {
    patch_company: {
      findFirst: findFirstMock,
      create: createMock,
      update: updateMock,
      delete: deleteMock
    }
  }
}))

vi.mock('~/app/api/company/service', () => ({
  getCompanyById: vi.fn()
}))

vi.mock('~/app/api/company/cache', () => ({
  invalidateCompanyListCache: invalidateMock
}))

import { DELETE, POST, PUT } from '~/app/api/company/route'

const CREATE_INPUT = {
  name: 'Key',
  primary_language: ['ja'],
  introduction: '',
  alias: [],
  official_website: [],
  parent_brand: []
}
const COMPANY = { id: 1, name: 'Key', count: 0, alias: [] }
const request = new Request('http://localhost') as unknown as Parameters<
  typeof POST
>[0]

describe('company list cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyHeaderCookieMock.mockResolvedValue({ uid: 7, role: 3 })
    findFirstMock.mockResolvedValue(null)
    createMock.mockResolvedValue(COMPANY)
    updateMock.mockResolvedValue(COMPANY)
    deleteMock.mockResolvedValue(COMPANY)
    invalidateMock.mockResolvedValue(undefined)
    parsePostMock.mockResolvedValue(CREATE_INPUT)
    parsePutMock.mockResolvedValue({ ...CREATE_INPUT, companyId: 1 })
    parseDeleteMock.mockReturnValue({ companyId: 1 })
  })

  it('invalidates only after a company is created', async () => {
    const events: string[] = []
    createMock.mockImplementation(async () => {
      events.push('database-write')
      return COMPANY
    })
    invalidateMock.mockImplementation(async () => {
      events.push('cache-invalidation')
    })

    const response = await POST(request)

    expect(await response.json()).toEqual(COMPANY)
    expect(events).toEqual(['database-write', 'cache-invalidation'])
  })

  it('does not invalidate when creation finds an existing company', async () => {
    findFirstMock.mockResolvedValue(COMPANY)

    const response = await POST(request)

    expect(await response.json()).toBe('这个会社已经存在了')
    expect(createMock).not.toHaveBeenCalled()
    expect(invalidateMock).not.toHaveBeenCalled()
  })

  it('invalidates after a company update succeeds', async () => {
    await PUT(request)

    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(invalidateMock).toHaveBeenCalledTimes(1)
  })

  it('invalidates after a company deletion succeeds', async () => {
    await DELETE(request)

    expect(deleteMock).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(invalidateMock).toHaveBeenCalledTimes(1)
  })

  it('does not invalidate when the database write fails', async () => {
    createMock.mockRejectedValue(new Error('database down'))

    await expect(POST(request)).rejects.toThrow('database down')
    expect(invalidateMock).not.toHaveBeenCalled()
  })
})
