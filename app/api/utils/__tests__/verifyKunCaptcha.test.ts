import { beforeEach, describe, expect, it, vi } from 'vitest'

const { takeKvMock } = vi.hoisted(() => ({
  takeKvMock: vi.fn()
}))

vi.mock('~/lib/redis', () => ({
  takeKv: takeKvMock
}))

import { checkKunCaptchaExist } from '~/app/api/utils/verifyKunCaptcha'

const VALID_TOKEN = '0123456789abcdef0123456789abcdef'

describe('checkKunCaptchaExist', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('passes when the token is atomically consumed', async () => {
    takeKvMock.mockResolvedValue(true)

    const result = await checkKunCaptchaExist(VALID_TOKEN)

    expect(result).toBe(true)
    expect(takeKvMock).toHaveBeenCalledWith(`captcha:verify:${VALID_TOKEN}`)
  })

  it('rejects when the token was already consumed', async () => {
    takeKvMock.mockResolvedValue(false)

    const result = await checkKunCaptchaExist(VALID_TOKEN)

    expect(result).toBe(false)
    expect(takeKvMock).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed tokens without touching redis', async () => {
    const result = await checkKunCaptchaExist('not-a-token')

    expect(result).toBe(false)
    expect(takeKvMock).not.toHaveBeenCalled()
  })

  it('trims whitespace before validating the token', async () => {
    takeKvMock.mockResolvedValue(true)

    const result = await checkKunCaptchaExist(`  ${VALID_TOKEN}  `)

    expect(result).toBe(true)
    expect(takeKvMock).toHaveBeenCalledWith(`captcha:verify:${VALID_TOKEN}`)
  })
})
