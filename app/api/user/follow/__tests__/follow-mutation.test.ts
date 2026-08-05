import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  parsePostMock,
  verifyHeaderCookieMock,
  transactionMock,
  relationCreateManyMock,
  relationDeleteManyMock,
  createDedupMessageMock
} = vi.hoisted(() => ({
  parsePostMock: vi.fn(),
  verifyHeaderCookieMock: vi.fn(),
  transactionMock: vi.fn(),
  relationCreateManyMock: vi.fn(),
  relationDeleteManyMock: vi.fn(),
  createDedupMessageMock: vi.fn()
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
  kunParsePostBody: parsePostMock
}))

vi.mock('~/middleware/_verifyHeaderCookie', () => ({
  verifyHeaderCookie: verifyHeaderCookieMock
}))

vi.mock('~/app/api/utils/message', () => ({
  createDedupMessage: createDedupMessageMock
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    $transaction: transactionMock,
    user_follow_relation: {
      deleteMany: relationDeleteManyMock
    }
  }
}))

import { POST as followRoute } from '~/app/api/user/follow/follow/route'
import { POST as unfollowRoute } from '~/app/api/user/follow/unfollow/route'

const mockRequest = new Request('http://localhost') as unknown as Parameters<
  typeof followRoute
>[0]

const txClient = {
  user_follow_relation: { createMany: relationCreateManyMock }
}

beforeEach(() => {
  vi.clearAllMocks()
  parsePostMock.mockResolvedValue({ uid: 7 })
  verifyHeaderCookieMock.mockResolvedValue({ uid: 99 })
  transactionMock.mockImplementation(async (fn) => fn(txClient))
  relationCreateManyMock.mockResolvedValue({ count: 1 })
  relationDeleteManyMock.mockResolvedValue({ count: 1 })
  createDedupMessageMock.mockResolvedValue(undefined)
})

describe('POST /api/user/follow/follow', () => {
  it('成功关注: skipDuplicates 幂等插入并经事务客户端发通知', async () => {
    const res = await followRoute(mockRequest)
    await expect(res.json()).resolves.toEqual({})

    expect(relationCreateManyMock).toHaveBeenCalledWith({
      data: [{ follower_id: 99, following_id: 7 }],
      skipDuplicates: true
    })
    expect(createDedupMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'follow', recipient_id: 7 }),
      txClient
    )
  })

  it('重复关注 (count 0) 幂等返回成功且不发通知', async () => {
    relationCreateManyMock.mockResolvedValue({ count: 0 })

    const res = await followRoute(mockRequest)
    await expect(res.json()).resolves.toEqual({})
    expect(createDedupMessageMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/user/follow/unfollow', () => {
  it('用 deleteMany 平铺条件删除关系', async () => {
    const res = await unfollowRoute(mockRequest)
    await expect(res.json()).resolves.toEqual({})

    expect(relationDeleteManyMock).toHaveBeenCalledWith({
      where: { follower_id: 99, following_id: 7 }
    })
  })

  it('关系已在别处取消时不抛错', async () => {
    relationDeleteManyMock.mockResolvedValue({ count: 0 })

    const res = await unfollowRoute(mockRequest)
    await expect(res.json()).resolves.toEqual({})
  })
})
