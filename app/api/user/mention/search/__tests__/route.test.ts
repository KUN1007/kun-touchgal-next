import { beforeEach, describe, expect, it, vi } from 'vitest'

const { kunParseGetQueryMock, verifyHeaderCookieMock, userFindManyMock } =
  vi.hoisted(() => ({
    kunParseGetQueryMock: vi.fn(),
    verifyHeaderCookieMock: vi.fn(),
    userFindManyMock: vi.fn()
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
  kunParseGetQuery: kunParseGetQueryMock
}))

vi.mock('~/middleware/_verifyHeaderCookie', () => ({
  verifyHeaderCookie: verifyHeaderCookieMock
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    user: {
      findMany: userFindManyMock
    }
  }
}))

import { GET as searchMentionUserRoute } from '~/app/api/user/mention/search/route'

const mockRequest = new Request('http://localhost') as unknown as Parameters<
  typeof searchMentionUserRoute
>[0]

beforeEach(() => {
  kunParseGetQueryMock.mockReset()
  verifyHeaderCookieMock.mockReset()
  userFindManyMock.mockReset()

  kunParseGetQueryMock.mockReturnValue({ query: 'alice' })
  verifyHeaderCookieMock.mockResolvedValue({ uid: 99 })
  userFindManyMock.mockResolvedValue([
    { id: 11, name: 'Alice', avatar: '/alice.webp' }
  ])
})

describe('GET /api/user/mention/search', () => {
  it('未登录直接拦截, 不触发任何查询', async () => {
    verifyHeaderCookieMock.mockResolvedValue(null)

    const response = await searchMentionUserRoute(mockRequest)
    const body = await response.json()

    expect(body).toBe('用户未登录')
    expect(userFindManyMock).not.toHaveBeenCalled()
  })

  it('登录后返回最小字段的用户列表', async () => {
    const response = await searchMentionUserRoute(mockRequest)
    const body = await response.json()

    expect(body).toEqual([{ id: 11, name: 'Alice', avatar: '/alice.webp' }])
  })

  it('查询按大小写不敏感 contains 匹配且 take 收敛为 10', async () => {
    const response = await searchMentionUserRoute(mockRequest)
    await response.json()

    expect(userFindManyMock).toHaveBeenCalledWith({
      where: {
        name: { contains: 'alice', mode: 'insensitive' }
      },
      select: {
        id: true,
        name: true,
        avatar: true
      },
      take: 10
    })
  })
})
