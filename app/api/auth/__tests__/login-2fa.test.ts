import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  checkCaptchaMock,
  cookieSetMock,
  createChallengeMock,
  findFirstMock,
  generateStatelessTokenMock,
  kunParsePostBodyMock,
  verifyPasswordMock
} = vi.hoisted(() => ({
  checkCaptchaMock: vi.fn(),
  cookieSetMock: vi.fn(),
  createChallengeMock: vi.fn(),
  findFirstMock: vi.fn(),
  generateStatelessTokenMock: vi.fn(),
  kunParsePostBodyMock: vi.fn(),
  verifyPasswordMock: vi.fn()
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ set: cookieSetMock })
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

vi.mock('~/app/api/utils/algorithm', () => ({
  DUMMY_PASSWORD_HASH: 'dummy',
  hashPassword: vi.fn(),
  needsPasswordRehash: () => false,
  verifyPassword: verifyPasswordMock
}))

vi.mock('~/app/api/utils/jwt', () => ({
  generateKunStatelessToken: generateStatelessTokenMock,
  generateKunToken: vi.fn()
}))

vi.mock('~/app/api/utils/cookieOptions', () => ({
  kunCookieOptions: (maxAge: number) => ({ maxAge })
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    user: { findFirst: findFirstMock, updateMany: vi.fn() }
  }
}))

vi.mock('~/app/api/utils/verifyKunCaptcha', () => ({
  checkKunCaptchaExist: checkCaptchaMock
}))

vi.mock('~/app/api/admin/setting/redirect/getRedirectConfig', () => ({
  getRedirectConfig: vi.fn()
}))

vi.mock('~/app/api/user/status/service', () => ({
  updateUserLastLoginTime: vi.fn()
}))

vi.mock('~/app/api/utils/getRemoteIp', () => ({
  getRemoteIp: () => '203.0.113.8'
}))

vi.mock('~/app/api/auth/_twoFactorChallenge', () => ({
  createTwoFactorChallenge: createChallengeMock,
  TWO_FACTOR_CHALLENGE_TTL_SECONDS: 600
}))

import { POST } from '~/app/api/auth/login/route'

const createRequest = () =>
  new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'user-agent': 'vitest' }
  }) as unknown as Parameters<typeof POST>[0]

beforeEach(() => {
  vi.clearAllMocks()
  kunParsePostBodyMock.mockResolvedValue({
    name: 'tester',
    password: 'password1',
    captcha: 'captcha-token'
  })
  checkCaptchaMock.mockResolvedValue('captcha')
  verifyPasswordMock.mockResolvedValue(true)
  findFirstMock.mockResolvedValue({
    id: 7,
    name: 'tester',
    email: 'tester@example.com',
    password: 'password-hash',
    status: 0,
    enable_2fa: true,
    avatar: ''
  })
  createChallengeMock.mockResolvedValue(undefined)
  generateStatelessTokenMock.mockReturnValue('temp-token')
})

describe('POST /api/auth/login with 2FA', () => {
  it('stores a stateful challenge before setting the temporary token', async () => {
    const response = await POST(createRequest())
    const body = await response.json()

    expect(body).toMatchObject({ require2FA: true, id: 7 })
    const jti = createChallengeMock.mock.calls[0][0]
    expect(jti).toEqual(expect.any(String))
    expect(createChallengeMock).toHaveBeenCalledWith(jti, 7)
    expect(generateStatelessTokenMock).toHaveBeenCalledWith(
      { id: 7, require2FA: true, jti },
      600
    )
    expect(createChallengeMock.mock.invocationCallOrder[0]).toBeLessThan(
      cookieSetMock.mock.invocationCallOrder[0]
    )
    expect(cookieSetMock).toHaveBeenCalledWith(
      'kun-galgame-patch-moe-2fa-token',
      'temp-token',
      { maxAge: 600 }
    )
  })

  it('does not issue a stateless fallback when Redis is unavailable', async () => {
    createChallengeMock.mockRejectedValue(new Error('redis unavailable'))

    const response = await POST(createRequest())

    await expect(response.json()).resolves.toBe(
      '2FA 验证服务暂不可用, 请稍后重试'
    )
    expect(generateStatelessTokenMock).not.toHaveBeenCalled()
    expect(cookieSetMock).not.toHaveBeenCalled()
  })
})
