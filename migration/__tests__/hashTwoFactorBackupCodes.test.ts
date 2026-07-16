import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { disconnectMock, findManyMock, findUniqueMock, updateManyMock } =
  vi.hoisted(() => ({
    disconnectMock: vi.fn(),
    findManyMock: vi.fn(),
    findUniqueMock: vi.fn(),
    updateManyMock: vi.fn()
  }))

vi.mock('~/prisma/index', () => ({
  prisma: {
    $disconnect: disconnectMock,
    user: {
      findMany: findManyMock,
      findUnique: findUniqueMock,
      updateMany: updateManyMock
    }
  }
}))

const waitForMigration = async () => {
  await vi.waitFor(() => expect(disconnectMock).toHaveBeenCalledTimes(1))
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv(
    'KUN_TWO_FACTOR_BACKUP_PEPPER',
    'test-only-two-factor-backup-pepper-1234567890'
  )
  process.exitCode = undefined
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  process.exitCode = undefined
  vi.restoreAllMocks()
})

describe('hashTwoFactorBackupCodes migration', () => {
  it('rereads and retries a user after one concurrent update conflict', async () => {
    findManyMock
      .mockResolvedValueOnce([
        { id: 7, two_factor_backup: ['123456', '654321'] }
      ])
      .mockResolvedValueOnce([])
    updateManyMock
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    findUniqueMock.mockResolvedValue({
      id: 7,
      two_factor_backup: ['654321']
    })

    await import('~/migration/hashTwoFactorBackupCodes')
    await waitForMigration()

    expect(findUniqueMock).toHaveBeenCalledTimes(1)
    expect(updateManyMock).toHaveBeenCalledTimes(2)
    expect(updateManyMock.mock.calls[1][0]).toMatchObject({
      where: {
        id: 7,
        two_factor_backup: { equals: ['654321'] }
      },
      data: {
        two_factor_backup: [expect.stringMatching(/^h1:[0-9a-f]{64}$/)]
      }
    })
    expect(process.exitCode).toBeUndefined()
  })

  it('exits unsuccessfully when the retry also conflicts', async () => {
    findManyMock
      .mockResolvedValueOnce([{ id: 7, two_factor_backup: ['123456'] }])
      .mockResolvedValueOnce([])
    updateManyMock.mockResolvedValue({ count: 0 })
    findUniqueMock.mockResolvedValue({
      id: 7,
      two_factor_backup: ['654321']
    })

    await import('~/migration/hashTwoFactorBackupCodes')
    await waitForMigration()

    expect(updateManyMock).toHaveBeenCalledTimes(2)
    expect(process.exitCode).toBe(1)
    expect(console.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          '1 users still had concurrent backup code changes; rerun the migration'
      })
    )
  })
})
