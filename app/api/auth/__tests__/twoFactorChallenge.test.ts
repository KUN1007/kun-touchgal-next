import { beforeEach, describe, expect, it, vi } from 'vitest'

const { evalKvScriptMock, getKvMock, setKvIfAbsentMock } = vi.hoisted(() => ({
  evalKvScriptMock: vi.fn(),
  getKvMock: vi.fn(),
  setKvIfAbsentMock: vi.fn()
}))

vi.mock('~/lib/redis', () => ({
  evalKvScript: evalKvScriptMock,
  getKv: getKvMock,
  setKvIfAbsent: setKvIfAbsentMock
}))

import {
  consumeTwoFactorChallenge,
  createTwoFactorChallenge,
  isTwoFactorChallengeActive,
  reserveTwoFactorAttempt
} from '~/app/api/auth/_twoFactorChallenge'

beforeEach(() => {
  vi.clearAllMocks()
  setKvIfAbsentMock.mockResolvedValue(true)
})

describe('2FA challenge', () => {
  it('creates a unique 10-minute challenge bound to the user', async () => {
    await createTwoFactorChallenge('challenge-id', 7)

    expect(setKvIfAbsentMock).toHaveBeenCalledWith(
      'auth:2fa:challenge:challenge-id',
      '7',
      600
    )
  })

  it('fails closed when a challenge id collision occurs', async () => {
    setKvIfAbsentMock.mockResolvedValue(false)

    await expect(createTwoFactorChallenge('challenge-id', 7)).rejects.toThrow(
      'Failed to create unique 2FA challenge'
    )
  })

  it('checks that the Redis challenge still belongs to the token subject', async () => {
    getKvMock.mockResolvedValue('7')
    await expect(isTwoFactorChallengeActive('challenge-id', 7)).resolves.toBe(
      true
    )

    getKvMock.mockResolvedValue('8')
    await expect(isTwoFactorChallengeActive('challenge-id', 7)).resolves.toBe(
      false
    )
  })

  it('reserves challenge, uid, and ip budgets in one Redis script call', async () => {
    evalKvScriptMock.mockResolvedValue([1, 4])

    await expect(
      reserveTwoFactorAttempt('challenge-id', 7, '203.0.113.8')
    ).resolves.toEqual({ allowed: true, remainingAttempts: 4 })

    const [, keys, args] = evalKvScriptMock.mock.calls[0]
    expect(keys).toHaveLength(4)
    expect(keys[0]).toBe('auth:2fa:challenge:challenge-id')
    expect(keys[1]).toBe('auth:2fa:challenge-attempts:challenge-id')
    expect(keys[2]).toBe('auth:2fa:uid-attempts:7')
    expect(keys[3]).toMatch(/^auth:2fa:uid-ip-attempts:7:[0-9a-f]{64}$/)
    expect(keys[3]).not.toContain('203.0.113.8')
    expect(args).toEqual([7, 5, 10, 900, 5, 1, 600, 900])
  })

  it('isolates the same IP budget by user id', async () => {
    evalKvScriptMock.mockResolvedValue([1, 4])

    await reserveTwoFactorAttempt('challenge-7', 7, '203.0.113.8')
    await reserveTwoFactorAttempt('challenge-8', 8, '203.0.113.8')

    const firstKey = evalKvScriptMock.mock.calls[0][1][3]
    const secondKey = evalKvScriptMock.mock.calls[1][1][3]
    expect(firstKey).toMatch(/^auth:2fa:uid-ip-attempts:7:/)
    expect(secondKey).toMatch(/^auth:2fa:uid-ip-attempts:8:/)
    expect(firstKey).not.toBe(secondKey)
  })

  it.each([
    [0, 'expired'],
    [-1, 'invalid'],
    [2, 'challenge'],
    [3, 'uid'],
    [4, 'uidIp']
  ] as const)(
    'maps Redis status %s to %s rejection',
    async (status, reason) => {
      evalKvScriptMock.mockResolvedValue([status, 0])

      await expect(
        reserveTwoFactorAttempt('challenge-id', 7, '')
      ).resolves.toEqual({ allowed: false, reason })
    }
  )

  it('consumes the challenge and its attempt counter atomically', async () => {
    evalKvScriptMock.mockResolvedValue(1)

    await expect(
      consumeTwoFactorChallenge('challenge-id', 7, '203.0.113.8')
    ).resolves.toBe(true)
    const [, keys, args] = evalKvScriptMock.mock.calls[0]
    expect(keys).toEqual([
      'auth:2fa:challenge:challenge-id',
      'auth:2fa:challenge-attempts:challenge-id',
      'auth:2fa:uid-attempts:7',
      expect.stringMatching(/^auth:2fa:uid-ip-attempts:7:[0-9a-f]{64}$/)
    ])
    expect(args).toEqual([7, 1])
  })
})
