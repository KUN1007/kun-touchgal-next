import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  consumeBackupCodeMock,
  consumeChallengeMock,
  cookieDeleteMock,
  cookieSetMock,
  findUniqueMock,
  generateKunTokenMock,
  getRedirectConfigMock,
  kunParsePostBodyMock,
  parseCookiesMock,
  reserveAttemptMock,
  totpValidateMock,
  updateLastLoginMock,
  verify2FAMock
} = vi.hoisted(() => ({
  consumeBackupCodeMock: vi.fn(),
  consumeChallengeMock: vi.fn(),
  cookieDeleteMock: vi.fn(),
  cookieSetMock: vi.fn(),
  findUniqueMock: vi.fn(),
  generateKunTokenMock: vi.fn(),
  getRedirectConfigMock: vi.fn(),
  kunParsePostBodyMock: vi.fn(),
  parseCookiesMock: vi.fn(),
  reserveAttemptMock: vi.fn(),
  totpValidateMock: vi.fn(),
  updateLastLoginMock: vi.fn(),
  verify2FAMock: vi.fn()
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    delete: cookieDeleteMock,
    set: cookieSetMock
  })
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

vi.mock('~/app/api/utils/jwt', () => ({
  generateKunToken: generateKunTokenMock
}))

vi.mock('~/app/api/utils/cookieOptions', () => ({
  kunCookieOptions: (maxAge: number) => ({ maxAge })
}))

vi.mock('~/prisma/index', () => ({
  prisma: { user: { findUnique: findUniqueMock } }
}))

vi.mock('~/app/api/admin/setting/redirect/getRedirectConfig', () => ({
  getRedirectConfig: getRedirectConfigMock
}))

vi.mock('~/app/api/user/status/service', () => ({
  updateUserLastLoginTime: updateLastLoginMock
}))

vi.mock('time2fa', () => ({
  Totp: { validate: totpValidateMock }
}))

vi.mock('~/utils/cookies', () => ({
  parseCookies: parseCookiesMock
}))

vi.mock('~/app/api/utils/verify2FA', () => ({
  verify2FA: verify2FAMock
}))

vi.mock('~/app/api/utils/getRemoteIp', () => ({
  getRemoteIp: () => '203.0.113.8'
}))

vi.mock('~/app/api/auth/_twoFactorChallenge', () => ({
  consumeTwoFactorChallenge: consumeChallengeMock,
  reserveTwoFactorAttempt: reserveAttemptMock
}))

vi.mock('~/app/api/utils/twoFactorBackupCode', () => ({
  consumeTwoFactorBackupCode: consumeBackupCodeMock
}))

import { POST } from '~/app/api/auth/verify-2fa/route'

const user = {
  id: 7,
  name: 'tester',
  role: 1,
  enable_2fa: true,
  two_factor_secret: 'ABCDEFGHIJKLMN12',
  avatar: '',
  bio: '',
  moemoepoint: 0,
  daily_check_in: 0,
  daily_image_count: 0,
  daily_upload_size: 0,
  enable_email_notice: true,
  allow_private_message: true,
  blocked_tag_ids: []
}

const createRequest = () =>
  new Request('http://localhost/api/auth/verify-2fa', {
    method: 'POST',
    headers: {
      cookie: 'kun-galgame-patch-moe-2fa-token=temp-token',
      'user-agent': 'vitest'
    }
  }) as unknown as Parameters<typeof POST>[0]

beforeEach(() => {
  vi.clearAllMocks()
  kunParsePostBodyMock.mockResolvedValue({
    token: '123456',
    isBackupCode: false
  })
  parseCookiesMock.mockReturnValue({
    'kun-galgame-patch-moe-2fa-token': 'temp-token'
  })
  verify2FAMock.mockReturnValue({
    id: 7,
    jti: 'challenge-id',
    require2FA: true
  })
  reserveAttemptMock.mockResolvedValue({
    allowed: true,
    remainingAttempts: 4
  })
  findUniqueMock.mockResolvedValue(user)
  totpValidateMock.mockReturnValue(false)
  consumeChallengeMock.mockResolvedValue(true)
  generateKunTokenMock.mockResolvedValue('access-token')
  getRedirectConfigMock.mockResolvedValue({})
})

describe('POST /api/auth/verify-2fa', () => {
  it('locks further attempts without invalidating an in-flight challenge', async () => {
    reserveAttemptMock.mockResolvedValue({
      allowed: true,
      remainingAttempts: 0
    })

    const response = await POST(createRequest())

    await expect(response.json()).resolves.toBe('2FA 尝试次数过多, 请重新登录')
    expect(cookieDeleteMock).toHaveBeenCalledWith(
      'kun-galgame-patch-moe-2fa-token'
    )
    expect(consumeChallengeMock).not.toHaveBeenCalled()
    expect(generateKunTokenMock).not.toHaveBeenCalled()
  })

  it('allows an earlier reserved correct request to finish after the fifth failure', async () => {
    const firstUserRead = Promise.withResolvers<typeof user>()
    reserveAttemptMock
      .mockResolvedValueOnce({ allowed: true, remainingAttempts: 4 })
      .mockResolvedValueOnce({ allowed: true, remainingAttempts: 0 })
    findUniqueMock
      .mockImplementationOnce(() => firstUserRead.promise)
      .mockResolvedValueOnce(user)
    totpValidateMock.mockReturnValueOnce(false).mockReturnValueOnce(true)

    const earlierCorrectRequest = POST(createRequest())
    const fifthFailedResponse = await POST(createRequest())
    firstUserRead.resolve(user)
    const correctResponse = await earlierCorrectRequest

    await expect(fifthFailedResponse.json()).resolves.toBe(
      '2FA 尝试次数过多, 请重新登录'
    )
    expect(await correctResponse.json()).toMatchObject({ uid: 7 })
    expect(consumeChallengeMock).toHaveBeenCalledTimes(1)
    expect(generateKunTokenMock).toHaveBeenCalledTimes(1)
  })

  it('rejects uid or uid-ip limits before reading the user credential', async () => {
    reserveAttemptMock.mockResolvedValue({ allowed: false, reason: 'uid' })

    const response = await POST(createRequest())

    await expect(response.json()).resolves.toBe(
      '2FA 尝试次数过多, 请稍后重新登录'
    )
    expect(findUniqueMock).not.toHaveBeenCalled()
    expect(cookieDeleteMock).toHaveBeenCalled()
  })

  it('consumes the challenge before issuing the access session', async () => {
    totpValidateMock.mockReturnValue(true)

    const response = await POST(createRequest())
    const body = await response.json()

    expect(body).toMatchObject({ uid: 7, name: 'tester' })
    expect(consumeChallengeMock).toHaveBeenCalledWith(
      'challenge-id',
      7,
      '203.0.113.8'
    )
    expect(consumeChallengeMock.mock.invocationCallOrder[0]).toBeLessThan(
      generateKunTokenMock.mock.invocationCallOrder[0]
    )
    expect(cookieSetMock).toHaveBeenCalledWith(
      'kun-galgame-patch-moe-token',
      'access-token',
      { maxAge: 2592000 }
    )
  })

  it('does not issue a second session when the same token is replayed', async () => {
    totpValidateMock.mockReturnValue(true)
    consumeChallengeMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)

    const firstResponse = await POST(createRequest())
    const secondResponse = await POST(createRequest())

    expect(await firstResponse.json()).toMatchObject({ uid: 7 })
    await expect(secondResponse.json()).resolves.toBe(
      '2FA 临时令牌已失效, 请重新登录'
    )
    expect(generateKunTokenMock).toHaveBeenCalledTimes(1)
  })

  it('fails closed when Redis cannot reserve an attempt', async () => {
    reserveAttemptMock.mockRejectedValue(new Error('redis unavailable'))

    const response = await POST(createRequest())

    await expect(response.json()).resolves.toBe(
      '2FA 验证服务暂不可用, 请稍后重试'
    )
    expect(findUniqueMock).not.toHaveBeenCalled()
    expect(generateKunTokenMock).not.toHaveBeenCalled()
  })
})
