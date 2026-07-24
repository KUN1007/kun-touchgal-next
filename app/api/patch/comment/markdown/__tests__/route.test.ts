import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCommentRatingVisibilityWhere } from '~/app/api/utils/contentVisibility'

const { parseGetMock, verifyHeaderCookieMock, findFirstMock } = vi.hoisted(
  () => ({
    parseGetMock: vi.fn(),
    verifyHeaderCookieMock: vi.fn(),
    findFirstMock: vi.fn()
  })
)

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' }
      })
  }
}))

vi.mock('~/app/api/utils/parseQuery', () => ({
  kunParseGetQuery: parseGetMock
}))

vi.mock('~/middleware/_verifyHeaderCookie', () => ({
  verifyHeaderCookie: verifyHeaderCookieMock
}))

vi.mock('~/prisma', () => ({
  prisma: {
    patch_comment: {
      findFirst: findFirstMock
    }
  }
}))

import { GET } from '~/app/api/patch/comment/markdown/route'

const request = new Request('http://localhost') as unknown as Parameters<
  typeof GET
>[0]

describe('comment markdown endpoint visibility gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    parseGetMock.mockReturnValue({ commentId: 42 })
    verifyHeaderCookieMock.mockResolvedValue({ uid: 7, role: 1 })
    findFirstMock.mockResolvedValue({ content: 'hi', is_spoiler: false })
  })

  it('rejects unauthenticated callers without touching the database', async () => {
    verifyHeaderCookieMock.mockResolvedValue(null)

    const response = await GET(request)

    expect(await response.json()).toBe('用户未登录')
    expect(findFirstMock).not.toHaveBeenCalled()
  })

  it('restricts an anonymous-role viewer to public comments only', async () => {
    verifyHeaderCookieMock.mockResolvedValue({ uid: 0, role: 0 })

    await GET(request)

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: 42,
        ...getCommentRatingVisibilityWhere({ uid: 0, role: 0 })
      },
      select: { content: true, is_spoiler: true }
    })
  })

  it('lets a logged-in user see public comments and their own pending ones', async () => {
    await GET(request)

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        id: 42,
        OR: [{ status: 0 }, { status: 1, user_id: 7 }]
      },
      select: { content: true, is_spoiler: true }
    })
  })

  it('lets an admin see public and pending comments but not hidden ones', async () => {
    verifyHeaderCookieMock.mockResolvedValue({ uid: 9, role: 3 })

    await GET(request)

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: 42, status: { in: [0, 1] } },
      select: { content: true, is_spoiler: true }
    })
  })

  it('returns empty content when the visibility filter excludes the comment', async () => {
    findFirstMock.mockResolvedValue(null)

    const response = await GET(request)

    expect(await response.json()).toEqual({ content: '', isSpoiler: false })
  })

  it('returns the markdown source when the comment is visible', async () => {
    findFirstMock.mockResolvedValue({
      content: 'secret draft',
      is_spoiler: true
    })

    const response = await GET(request)

    expect(await response.json()).toEqual({
      content: 'secret draft',
      isSpoiler: true
    })
  })
})
