import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  verifyHeaderCookieMock,
  userUpdateManyMock,
  invalidateUserSessionMock
} = vi.hoisted(() => ({
  verifyHeaderCookieMock: vi.fn(),
  userUpdateManyMock: vi.fn(),
  invalidateUserSessionMock: vi.fn()
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' }
      })
  }
}))

vi.mock('~/middleware/_verifyHeaderCookie', () => ({
  verifyHeaderCookie: verifyHeaderCookieMock
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    user: {
      updateMany: userUpdateManyMock
    }
  }
}))

vi.mock('~/app/api/user/session/cache', () => ({
  invalidateUserSession: invalidateUserSessionMock
}))

import { POST } from '~/app/api/user/setting/email-notice/route'

const createRequest = (body: unknown) =>
  new Request('http://localhost/api/user/setting/email-notice', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }) as unknown as Parameters<typeof POST>[0]

beforeEach(() => {
  verifyHeaderCookieMock.mockReset()
  userUpdateManyMock.mockReset()
  invalidateUserSessionMock.mockReset()

  verifyHeaderCookieMock.mockResolvedValue({ uid: 7 })
  userUpdateManyMock.mockResolvedValue({ count: 1 })
  invalidateUserSessionMock.mockResolvedValue(undefined)
})

describe('POST /api/user/setting/email-notice', () => {
  it('body 缺少期望值时返回校验错误字符串且不写库', async () => {
    const response = await POST(createRequest({}))
    const body = await response.json()

    expect(typeof body).toBe('string')
    expect(userUpdateManyMock).not.toHaveBeenCalled()
  })

  it('未登录时返回错误字符串且不写库', async () => {
    verifyHeaderCookieMock.mockResolvedValue(null)

    const response = await POST(createRequest({ enableEmailNotice: true }))
    const body = await response.json()

    expect(body).toBe('用户未登录')
    expect(userUpdateManyMock).not.toHaveBeenCalled()
  })

  it('按请求中的期望值绝对赋值而非翻转', async () => {
    const response = await POST(createRequest({ enableEmailNotice: false }))
    const body = await response.json()

    expect(userUpdateManyMock).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { enable_email_notice: false }
    })
    expect(invalidateUserSessionMock).toHaveBeenCalledWith(7)
    expect(body).toEqual({})
  })

  it('用户不存在时返回未找到用户且不失效缓存', async () => {
    userUpdateManyMock.mockResolvedValue({ count: 0 })

    const response = await POST(createRequest({ enableEmailNotice: true }))
    const body = await response.json()

    expect(body).toBe('未找到用户')
    expect(invalidateUserSessionMock).not.toHaveBeenCalled()
  })
})
