import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { moderation_taskModel } from '~/prisma/generated/prisma/models'

const {
  transactionMock,
  executeRawMock,
  claimMock,
  findRatingMock,
  updateRatingMock,
  updateUserMock,
  recomputeOneMock
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  executeRawMock: vi.fn(),
  claimMock: vi.fn(),
  findRatingMock: vi.fn(),
  updateRatingMock: vi.fn(),
  updateUserMock: vi.fn(),
  recomputeOneMock: vi.fn()
}))

const transactionClient = {
  $executeRaw: executeRawMock,
  moderation_task: { updateMany: claimMock },
  patch_rating: { findUnique: findRatingMock, update: updateRatingMock },
  user: { update: updateUserMock }
}

const events: string[] = []

vi.mock('~/prisma/index', () => ({
  prisma: { $transaction: transactionMock }
}))

vi.mock('~/app/api/utils/message', () => ({
  createDedupMessage: vi.fn(),
  createMessage: vi.fn()
}))

vi.mock('~/app/api/utils/createMentionMessage', () => ({
  createMentionMessage: vi.fn()
}))

vi.mock('~/app/api/patch/rating/stat', () => ({
  recomputePatchRatingStat: recomputeOneMock
}))

vi.mock('~/app/api/patch/resource/_helper', () => ({
  recalcPatchType: vi.fn()
}))

vi.mock('~/app/api/resource/cache', () => ({
  invalidateResourceListCache: vi.fn()
}))

vi.mock('~/app/api/user/session/cache', () => ({
  invalidateUserSession: vi.fn()
}))

vi.mock('~/server/search/sync', () => ({
  queueSearchSync: vi.fn()
}))

vi.mock('~/app/api/utils/purgeCloudflareCache', () => ({
  purgeCloudflareCache: vi.fn()
}))

vi.mock('~/lib/s3', () => ({
  copyObject: vi.fn(),
  deleteFileFromS3: vi.fn()
}))

import { applyModerationVerdict } from '~/server/moderation/apply'

const created = new Date('2026-01-01T00:00:00.000Z')
const ratingTask = (overrides: Partial<moderation_taskModel> = {}) =>
  ({
    id: 1,
    content_type: 'rating',
    content_id: 5,
    patch_id: 10,
    payload: { text: 'kun' },
    status: 'pending',
    reject_code: '',
    reject_reason: '',
    verdict: null,
    model: '',
    tokens_in: 0,
    tokens_out: 0,
    retry: 0,
    next_attempt: created,
    picked_at: null,
    dry_run: false,
    reviewed: null,
    user_id: 100,
    created,
    updated: created,
    ...overrides
  }) as moderation_taskModel

const joinSql = (call: unknown[]) =>
  (call[0] as TemplateStringsArray).join('?').replace(/\s+/g, ' ').trim()

beforeEach(() => {
  vi.clearAllMocks()
  events.length = 0
  executeRawMock.mockResolvedValue(1)
  claimMock.mockResolvedValue({ count: 1 })
  findRatingMock.mockResolvedValue({ patch_id: 10, status: 1 })
  updateRatingMock.mockResolvedValue({})
  updateUserMock.mockResolvedValue({})
  recomputeOneMock.mockImplementation(
    async (_patchId: number, tx: typeof transactionClient) => {
      expect(tx).toBe(transactionClient)
      events.push('recompute')
    }
  )
  transactionMock.mockImplementation(
    async (callback: (tx: typeof transactionClient) => Promise<unknown>) => {
      events.push('transaction-start')
      const result = await callback(transactionClient)
      events.push('transaction-commit')
      return result
    }
  )
})

describe('applyModerationVerdict', () => {
  it('locks the user and content rows before claiming the task to keep lock order aligned with delete paths', async () => {
    await expect(
      applyModerationVerdict({ task: ratingTask(), approved: true })
    ).resolves.toBe(true)

    expect(executeRawMock).toHaveBeenCalledTimes(2)
    const userLockSql = joinSql(executeRawMock.mock.calls[0])
    expect(userLockSql).toContain('FROM "user"')
    expect(userLockSql).toContain('FOR KEY SHARE')
    expect(executeRawMock.mock.calls[0][1]).toBe(100)

    const contentLockSql = joinSql(executeRawMock.mock.calls[1])
    expect(contentLockSql).toContain('FROM patch_rating')
    expect(contentLockSql).toContain('FOR UPDATE')
    expect(executeRawMock.mock.calls[1][1]).toBe(5)

    expect(executeRawMock.mock.invocationCallOrder[0]).toBeLessThan(
      executeRawMock.mock.invocationCallOrder[1]
    )
    expect(executeRawMock.mock.invocationCallOrder[1]).toBeLessThan(
      claimMock.mock.invocationCallOrder[0]
    )

    expect(updateRatingMock).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: 0 }
    })
    expect(recomputeOneMock).toHaveBeenCalledWith(10, transactionClient)
    expect(events).toEqual([
      'transaction-start',
      'recompute',
      'transaction-commit'
    ])
  })

  it('locks the user once with FOR UPDATE for profile verdicts', async () => {
    await expect(
      applyModerationVerdict({
        task: ratingTask({
          content_type: 'bio',
          content_id: null,
          patch_id: null,
          payload: { text: 'new bio', bio: 'new bio' }
        }),
        approved: true
      })
    ).resolves.toBe(true)

    expect(executeRawMock).toHaveBeenCalledTimes(1)
    const userLockSql = joinSql(executeRawMock.mock.calls[0])
    expect(userLockSql).toContain('FROM "user"')
    expect(userLockSql).toContain('FOR UPDATE')
    expect(userLockSql).not.toContain('FOR KEY SHARE')
    expect(executeRawMock.mock.calls[0][1]).toBe(100)
    expect(executeRawMock.mock.invocationCallOrder[0]).toBeLessThan(
      claimMock.mock.invocationCallOrder[0]
    )

    expect(updateUserMock).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { bio: 'new bio', bio_status: 0 }
    })
  })

  it('skips the content lock for dry-run tasks', async () => {
    await expect(
      applyModerationVerdict({
        task: ratingTask({ dry_run: true }),
        approved: true
      })
    ).resolves.toBe(true)

    expect(executeRawMock).not.toHaveBeenCalled()
    expect(claimMock).toHaveBeenCalledTimes(1)
    expect(findRatingMock).not.toHaveBeenCalled()
  })

  it('skips the content lock when the verdict defers to manual review', async () => {
    await expect(
      applyModerationVerdict({
        task: ratingTask(),
        approved: false,
        manual: true
      })
    ).resolves.toBe(true)

    expect(executeRawMock).not.toHaveBeenCalled()
    expect(claimMock).toHaveBeenCalledTimes(1)
    expect(findRatingMock).not.toHaveBeenCalled()
  })
})
