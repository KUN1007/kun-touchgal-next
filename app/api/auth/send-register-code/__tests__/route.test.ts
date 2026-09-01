import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  checkCaptchaMock,
  findFirstMock,
  findUniqueMock,
  getKvMock,
  kunParsePostBodyMock,
  sendVerificationCodeEmailMock
} = vi.hoisted(() => ({
  checkCaptchaMock: vi.fn(),
  findFirstMock: vi.fn(),
  findUniqueMock: vi.fn(),
  getKvMock: vi.fn(),
  kunParsePostBodyMock: vi.fn(),
  sendVerificationCodeEmailMock: vi.fn()
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

vi.mock('~/app/api/utils/sendVerificationCodeEmail', () => ({
  sendVerificationCodeEmail: sendVerificationCodeEmailMock
}))

vi.mock('~/app/api/utils/verifyKunCaptcha', () => ({
  checkKunCaptchaExist: checkCaptchaMock
}))

vi.mock('~/lib/redis', () => ({
  getKv: getKvMock
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    user: { findFirst: findFirstMock, findUnique: findUniqueMock }
  }
}))

import { POST } from '~/app/api/auth/send-register-code/route'

const createRequest = () =>
  new Request('http://localhost/api/auth/send-register-code', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.8' }
  }) as unknown as Parameters<typeof POST>[0]

beforeEach(() => {
  vi.clearAllMocks()
  kunParsePostBodyMock.mockResolvedValue({
    name: 'tester',
    email: 'tester@example.com',
    captcha: 'captcha-token'
  })
  checkCaptchaMock.mockResolvedValue(true)
  findFirstMock.mockResolvedValue(null)
  findUniqueMock.mockResolvedValue(null)
  sendVerificationCodeEmailMock.mockResolvedValue(undefined)
  getKvMock.mockResolvedValue(null)
})

describe('POST /api/auth/send-register-code with register disabled', () => {
  it('rejects before the one-time captcha token is consumed', async () => {
    getKvMock.mockResolvedValue('true')

    const response = await POST(createRequest())

    await expect(response.json()).resolves.toBe(
      '由于网站近日遭受大量攻击，当前时间段暂时不可注册，请明天下午再来，一定要来哦'
    )
    expect(checkCaptchaMock).not.toHaveBeenCalled()
    expect(sendVerificationCodeEmailMock).not.toHaveBeenCalled()
  })

  it('still verifies the captcha while the kill switch is off', async () => {
    const response = await POST(createRequest())

    await expect(response.json()).resolves.toEqual({})
    expect(checkCaptchaMock).toHaveBeenCalledWith('captcha-token')
    expect(sendVerificationCodeEmailMock).toHaveBeenCalledTimes(1)
  })
})
