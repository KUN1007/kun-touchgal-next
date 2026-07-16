import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  executeRawMock,
  findUniqueMock,
  generateBackupCodesMock,
  kunParsePostBodyMock,
  totpValidateMock,
  updateMock,
  verifyHeaderCookieMock
} = vi.hoisted(() => ({
  executeRawMock: vi.fn(),
  findUniqueMock: vi.fn(),
  generateBackupCodesMock: vi.fn(),
  kunParsePostBodyMock: vi.fn(),
  totpValidateMock: vi.fn(),
  updateMock: vi.fn(),
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

vi.mock('~/prisma/index', () => ({
  prisma: {
    $executeRaw: executeRawMock,
    user: { findUnique: findUniqueMock, update: updateMock }
  }
}))

vi.mock('time2fa', () => ({
  generateBackupCodes: generateBackupCodesMock,
  Totp: { validate: totpValidateMock }
}))

vi.mock('~/middleware/_verifyHeaderCookie', () => ({
  verifyHeaderCookie: verifyHeaderCookieMock
}))

vi.mock('~/app/api/utils/parseQuery', () => ({
  kunParsePostBody: kunParsePostBodyMock
}))

import {
  consumeTwoFactorBackupCode,
  hashTwoFactorBackupCode,
  isHashedTwoFactorBackupCode
} from '~/app/api/utils/twoFactorBackupCode'
import { POST as enableTwoFactor } from '~/app/api/user/setting/2fa/enable/route'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv(
    'KUN_TWO_FACTOR_BACKUP_PEPPER',
    'test-only-two-factor-backup-pepper-1234567890'
  )
  executeRawMock.mockResolvedValue(1)
})

describe('2FA backup code storage', () => {
  it('hashes codes deterministically without changing the user-visible code', () => {
    const hashed = hashTwoFactorBackupCode('123456')

    expect(hashed).toMatch(/^h1:[0-9a-f]{64}$/)
    expect(hashed).not.toContain('123456')
    expect(hashTwoFactorBackupCode('123456')).toBe(hashed)
    expect(isHashedTwoFactorBackupCode(hashed)).toBe(true)
    expect(isHashedTwoFactorBackupCode('123456')).toBe(false)
  })

  it('atomically accepts and removes both migrated hashes and legacy plaintext', async () => {
    const hashed = hashTwoFactorBackupCode('123456')

    await expect(consumeTwoFactorBackupCode(7, '123456')).resolves.toBe(true)

    expect(executeRawMock.mock.calls[0].slice(1)).toEqual([
      '123456',
      hashed,
      7,
      '123456',
      hashed
    ])
  })

  it('returns the same six-digit codes while only storing hashes', async () => {
    generateBackupCodesMock.mockReturnValue(['123456', '654321'])
    totpValidateMock.mockReturnValue(true)
    kunParsePostBodyMock.mockResolvedValue({ token: '111111' })
    verifyHeaderCookieMock.mockResolvedValue({ uid: 7 })
    findUniqueMock.mockResolvedValue({ two_factor_secret: 'ABCDEFGHIJKLMN12' })

    const request = new Request(
      'http://localhost/api/user/setting/2fa/enable',
      { method: 'POST' }
    ) as unknown as Parameters<typeof enableTwoFactor>[0]
    const response = await enableTwoFactor(request)

    await expect(response.json()).resolves.toEqual({
      backupCode: ['123456', '654321']
    })
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        enable_2fa: true,
        two_factor_backup: [
          hashTwoFactorBackupCode('123456'),
          hashTwoFactorBackupCode('654321')
        ]
      }
    })
  })
})
