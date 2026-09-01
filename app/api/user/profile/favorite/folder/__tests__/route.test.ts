import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '~/prisma/generated/prisma/client'

const {
  parsePostMock,
  parsePutMock,
  verifyHeaderCookieMock,
  countMock,
  createMock,
  updateManyMock,
  findUniqueMock
} = vi.hoisted(() => ({
  parsePostMock: vi.fn(),
  parsePutMock: vi.fn(),
  verifyHeaderCookieMock: vi.fn(),
  countMock: vi.fn(),
  createMock: vi.fn(),
  updateManyMock: vi.fn(),
  findUniqueMock: vi.fn()
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
  kunParseGetQuery: vi.fn(),
  kunParsePostBody: parsePostMock,
  kunParsePutBody: parsePutMock,
  kunParseDeleteQuery: vi.fn()
}))

vi.mock('~/middleware/_verifyHeaderCookie', () => ({
  verifyHeaderCookie: verifyHeaderCookieMock
}))

vi.mock('~/app/api/patch/cache', () => ({
  bumpPatchFavoriteCacheVersion: vi.fn(),
  invalidatePatchFavoriteCaches: vi.fn()
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    user_patch_favorite_folder: {
      count: countMock,
      create: createMock,
      updateMany: updateManyMock,
      findUnique: findUniqueMock
    }
  }
}))

import { POST, PUT } from '~/app/api/user/profile/favorite/folder/route'

const mockRequest = new Request('http://localhost') as unknown as Parameters<
  typeof POST
>[0]

const duplicateNameError = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test'
  })

const folderRow = {
  id: 3,
  name: '想玩',
  description: '',
  is_public: true,
  _count: { patch: 0 }
}

beforeEach(() => {
  vi.resetAllMocks()
  parsePostMock.mockResolvedValue({
    name: '想玩',
    description: '',
    isPublic: true
  })
  parsePutMock.mockResolvedValue({
    folderId: 3,
    name: '想玩',
    description: '',
    isPublic: true
  })
  verifyHeaderCookieMock.mockResolvedValue({ uid: 42 })
  countMock.mockResolvedValue(0)
  createMock.mockResolvedValue(folderRow)
  updateManyMock.mockResolvedValue({ count: 1 })
  findUniqueMock.mockResolvedValue(folderRow)
})

describe('POST /api/user/profile/favorite/folder', () => {
  it('creates a folder and returns its payload', async () => {
    const res = await POST(mockRequest)
    await expect(res.json()).resolves.toEqual({
      id: 3,
      name: '想玩',
      description: '',
      is_public: true,
      isAdd: false,
      _count: { patch: 0 }
    })
  })

  it('turns a duplicate-name P2002 into a business error', async () => {
    createMock.mockRejectedValue(duplicateNameError())

    const res = await POST(mockRequest)
    await expect(res.json()).resolves.toBe('您已有同名的收藏夹, 请更换名称')
  })

  it('does not swallow unrelated prisma errors', async () => {
    createMock.mockRejectedValue(new Error('connection lost'))

    await expect(POST(mockRequest)).rejects.toThrow('connection lost')
  })
})

describe('PUT /api/user/profile/favorite/folder', () => {
  it('turns a duplicate-name P2002 on rename into a business error', async () => {
    updateManyMock.mockRejectedValue(duplicateNameError())

    const res = await PUT(mockRequest)
    await expect(res.json()).resolves.toBe('您已有同名的收藏夹, 请更换名称')
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it('does not swallow unrelated prisma errors', async () => {
    updateManyMock.mockRejectedValue(new Error('connection lost'))

    await expect(PUT(mockRequest)).rejects.toThrow('connection lost')
  })
})
