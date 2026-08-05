import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  adminLogCreateMock,
  kunParsePostBodyMock,
  sendEmailHTMLMock,
  userFindManyMock,
  userFindUniqueMock,
  verifyHeaderCookieMock
} = vi.hoisted(() => ({
  adminLogCreateMock: vi.fn(),
  kunParsePostBodyMock: vi.fn(),
  sendEmailHTMLMock: vi.fn(),
  userFindManyMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  verifyHeaderCookieMock: vi.fn()
}))

vi.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' }
      })
  }
}))

vi.mock('~/app/api/utils/parseQuery', () => ({
  kunParsePostBody: kunParsePostBodyMock
}))

vi.mock('~/middleware/_verifyHeaderCookie', () => ({
  verifyHeaderCookie: verifyHeaderCookieMock
}))

vi.mock('~/app/api/admin/mail/_send', () => ({
  sendEmailHTML: sendEmailHTMLMock
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    user: { findMany: userFindManyMock, findUnique: userFindUniqueMock },
    admin_log: { create: adminLogCreateMock }
  }
}))

import { POST } from '~/app/api/admin/mail/route'

const createRequest = () =>
  new Request('http://localhost/api/admin/mail', {
    method: 'POST'
  }) as unknown as Parameters<typeof POST>[0]

beforeEach(() => {
  vi.clearAllMocks()
  kunParsePostBodyMock.mockResolvedValue({
    templateId: 'test-template',
    variables: {}
  })
  verifyHeaderCookieMock.mockResolvedValue({ uid: 1, role: 4 })
  userFindUniqueMock.mockResolvedValue({ id: 1, name: 'admin' })
  userFindManyMock.mockResolvedValue([
    { email: 'a@example.com' },
    { email: 'b@example.com' },
    { email: 'c@example.com' }
  ])
  sendEmailHTMLMock.mockResolvedValue(undefined)
  adminLogCreateMock.mockResolvedValue({})
})

describe('POST /api/admin/mail', () => {
  it('reports zero failures when every send succeeds', async () => {
    const response = await POST(createRequest())

    await expect(response.json()).resolves.toEqual({ count: 3, failed: 0 })
    expect(sendEmailHTMLMock).toHaveBeenCalledTimes(3)
  })

  it('counts sends that return an error string as failed', async () => {
    sendEmailHTMLMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('邮件发送失败, 请稍后重试')
      .mockResolvedValueOnce('邮件发送失败, 请稍后重试')

    const response = await POST(createRequest())

    await expect(response.json()).resolves.toEqual({ count: 3, failed: 2 })
    expect(adminLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: expect.stringContaining('(共 3 封, 失败 2 封)')
      })
    })
  })
})
