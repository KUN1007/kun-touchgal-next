import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  kunParsePostBodyMock,
  setKvIfAbsentMock,
  setKvMock,
  validateChallengeMock
} = vi.hoisted(() => ({
  kunParsePostBodyMock: vi.fn(),
  setKvIfAbsentMock: vi.fn(),
  setKvMock: vi.fn(),
  validateChallengeMock: vi.fn()
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

vi.mock('capjs-core', () => ({
  validateChallenge: validateChallengeMock
}))

vi.mock('~/app/api/utils/parseQuery', () => ({
  kunParsePostBody: kunParsePostBodyMock
}))

vi.mock('~/lib/redis', () => ({
  delKv: vi.fn(),
  getKv: vi.fn(),
  setKv: setKvMock,
  setKvIfAbsent: setKvIfAbsentMock
}))

import { POST } from '~/app/api/auth/captcha/redeem/route'

const createRequest = () =>
  new Request('http://localhost/api/auth/captcha/redeem', {
    method: 'POST'
  }) as unknown as Parameters<typeof POST>[0]

beforeEach(() => {
  vi.clearAllMocks()
  process.env.KUN_CAP_SECRET = 'test-secret-test-secret-test-secret'
  kunParsePostBodyMock.mockResolvedValue({
    token: 'challenge-jwt',
    solutions: [1, 2, 3]
  })
  validateChallengeMock.mockResolvedValue({
    success: true,
    token: 'cap-internal-token',
    expires: Date.now() + 60000,
    scope: 'kun-captcha'
  })
  setKvIfAbsentMock.mockResolvedValue(true)
})

describe('POST /api/auth/captcha/redeem', () => {
  it('issues a 32-hex verify token on successful validation', async () => {
    const response = await POST(createRequest())
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.token).toMatch(/^[a-f0-9]{32}$/)
    expect(body.expires).toBeGreaterThan(Date.now())

    expect(setKvMock).toHaveBeenCalledWith(
      `captcha:verify:${body.token}`,
      'captcha',
      3600
    )
  })

  it('wires consumeNonce to a redis SET NX with second-based ttl', async () => {
    await POST(createRequest())

    const options = validateChallengeMock.mock.calls[0][2]
    expect(options.scope).toBe('kun-captcha')
    await options.consumeNonce('a1b2', 1500)
    expect(setKvIfAbsentMock).toHaveBeenCalledWith('captcha:nonce:a1b2', '1', 2)
  })

  it('returns success false without issuing token when validation fails', async () => {
    validateChallengeMock.mockResolvedValue({
      success: false,
      reason: 'invalid_solutions'
    })

    const response = await POST(createRequest())
    const body = await response.json()

    expect(body.success).toBe(false)
    expect(body.error).toBeTruthy()
    expect(setKvMock).not.toHaveBeenCalled()
  })

  it('returns success false when body validation fails', async () => {
    kunParsePostBodyMock.mockResolvedValue('非法的挑战答案格式')

    const response = await POST(createRequest())
    const body = await response.json()

    expect(body).toEqual({ success: false, error: '非法的挑战答案格式' })
    expect(validateChallengeMock).not.toHaveBeenCalled()
  })
})
