import { describe, expect, it } from 'vitest'
import { verifyLogin2FASchema } from '~/validations/auth'

describe('login 2FA validation', () => {
  it('keeps TOTP and backup codes as exactly six numeric digits', () => {
    expect(
      verifyLogin2FASchema.safeParse({
        token: '123456',
        isBackupCode: false
      }).success
    ).toBe(true)
    expect(
      verifyLogin2FASchema.safeParse({
        token: '654321',
        isBackupCode: true
      }).success
    ).toBe(true)
    expect(
      verifyLogin2FASchema.safeParse({
        token: 'ABCDEF',
        isBackupCode: true
      }).success
    ).toBe(false)
  })
})
