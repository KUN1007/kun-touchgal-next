import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { moderation_taskModel } from '~/prisma/generated/prisma/models'

const {
  transactionMock,
  executeRawMock,
  claimMock,
  findRatingMock,
  updateRatingMock,
  recomputeOneMock
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  executeRawMock: vi.fn(),
  claimMock: vi.fn(),
  findRatingMock: vi.fn(),
  updateRatingMock: vi.fn(),
  recomputeOneMock: vi.fn()
}))

const transactionClient = {
  $executeRaw: executeRawMock,
  moderation_task: { updateMany: claimMock },
  patch_rating: { findUnique: findRatingMock, update: updateRatingMock }
}

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
  executeRawMock.mockResolvedValue(1)
  claimMock.mockResolvedValue({ count: 1 })
  findRatingMock.mockResolvedValue({ patch_id: 10, status: 1 })
  updateRatingMock.mockResolvedValue({})
  recomputeOneMock.mockResolvedValue(undefined)
  transactionMock.mockImplementation(
    async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient)
  )
})

describe('applyModerationVerdict', () => {
  it('locks the content row before claiming the task to keep lock order aligned with delete paths', async () => {
    await expect(
      applyModerationVerdict({ task: ratingTask(), approved: true })
    ).resolves.toBe(true)

    expect(executeRawMock).toHaveBeenCalledTimes(1)
    const lockSql = joinSql(executeRawMock.mock.calls[0])
    expect(lockSql).toContain('FROM patch_rating')
    expect(lockSql).toContain('FOR UPDATE')
    expect(executeRawMock.mock.calls[0][1]).toBe(5)

    expect(executeRawMock.mock.invocationCallOrder[0]).toBeLessThan(
      claimMock.mock.invocationCallOrder[0]
    )

    expect(updateRatingMock).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: 0 }
    })
    expect(recomputeOneMock).toHaveBeenCalledWith(10)
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
