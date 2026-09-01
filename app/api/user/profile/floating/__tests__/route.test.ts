import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  kunParseGetQueryMock,
  verifyHeaderCookieMock,
  userFindUniqueMock,
  relationFindUniqueMock
} = vi.hoisted(() => ({
  kunParseGetQueryMock: vi.fn(),
  verifyHeaderCookieMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  relationFindUniqueMock: vi.fn()
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
      findUnique: userFindUniqueMock
    },
    user_follow_relation: {
      findUnique: relationFindUniqueMock
    }
  }
}))

import { GET } from '~/app/api/user/profile/floating/route'

const targetUid = 7
const currentUserUid = 99

const mockRequest = new Request('http://localhost') as unknown as Parameters<
  typeof GET
>[0]

const seedUser = () => {
  userFindUniqueMock.mockResolvedValue({
    id: targetUid,
    name: 'Alice',
    avatar: '/alice.webp',
    bio: 'alpha',
    moemoepoint: 100,
    role: 1,
    _count: { following: 5, patch: 2, patch_resource: 3 }
  })
}

beforeEach(() => {
  kunParseGetQueryMock.mockReset()
  verifyHeaderCookieMock.mockReset()
  userFindUniqueMock.mockReset()
  relationFindUniqueMock.mockReset()

  kunParseGetQueryMock.mockReturnValue({ uid: targetUid })
  verifyHeaderCookieMock.mockResolvedValue({ uid: currentUserUid })
  relationFindUniqueMock.mockResolvedValue(null)
})

describe('GET /api/user/profile/floating', () => {
  it('只 select 最小字段且计数取 following (粉丝数)', async () => {
    seedUser()

    const response = await GET(mockRequest)
    await response.json()

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { id: targetUid },
      select: {
        id: true,
        name: true,
        avatar: true,
        bio: true,
        moemoepoint: true,
        role: true,
        _count: {
          select: {
            following: true,
            patch: true,
            patch_resource: true
          }
        }
      }
    })
  })

  it('响应 _count.follower 映射自 _count.following', async () => {
    seedUser()

    const response = await GET(mockRequest)
    const body = await response.json()

    expect(body).toEqual({
      id: targetUid,
      name: 'Alice',
      avatar: '/alice.webp',
      bio: 'alpha',
      moemoepoint: 100,
      role: 1,
      isFollow: false,
      _count: { follower: 5, patch: 2, patch_resource: 3 }
    })
  })

  it('用户不存在时返回错误消息字符串', async () => {
    userFindUniqueMock.mockResolvedValue(null)

    const response = await GET(mockRequest)
    const body = await response.json()

    expect(body).toBe('未找到用户')
  })
})
