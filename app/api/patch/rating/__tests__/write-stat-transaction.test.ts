import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  findUniqueMock,
  transactionMock,
  createMock,
  updateMock,
  deleteMock,
  recomputeOneMock,
  preScreenTextMock,
  hasPendingModerationMock,
  createModerationTaskMock,
  deletePendingModerationTasksMock,
  collectPendingReportIdsMock,
  deleteReportsByIdsMock
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  recomputeOneMock: vi.fn(),
  preScreenTextMock: vi.fn(),
  hasPendingModerationMock: vi.fn(),
  createModerationTaskMock: vi.fn(),
  deletePendingModerationTasksMock: vi.fn(),
  collectPendingReportIdsMock: vi.fn(),
  deleteReportsByIdsMock: vi.fn()
}))

const events: string[] = []
const transactionClient = {
  patch_rating: {
    create: createMock,
    update: updateMock,
    delete: deleteMock
  }
}

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_rating: { findUnique: findUniqueMock },
    $transaction: transactionMock
  }
}))

vi.mock('~/app/api/patch/rating/stat', () => ({
  recomputePatchRatingStat: recomputeOneMock
}))

vi.mock('~/server/moderation/submit', () => ({
  MODERATION_SKIP: { queue: false, intercept: false, dryRun: false },
  preScreenText: preScreenTextMock,
  hasPendingModeration: hasPendingModerationMock,
  createModerationTask: createModerationTaskMock,
  deletePendingModerationTasks: deletePendingModerationTasksMock
}))

vi.mock('~/server/report/pending', () => ({
  collectPendingReportIds: collectPendingReportIdsMock,
  deleteReportsByIds: deleteReportsByIdsMock
}))

import { createPatchRating } from '~/app/api/patch/rating/create'
import { updatePatchRating } from '~/app/api/patch/rating/update'
import { deletePatchRating } from '~/app/api/patch/rating/delete'

const ratingInput = {
  recommend: 'yes',
  overall: 8,
  playStatus: 'finished_main',
  shortSummary: 'summary',
  spoilerLevel: 'none'
}
const createInput = { patchId: 10, ...ratingInput }
const updateInput = { ratingId: 5, ...ratingInput }
const created = new Date('2026-01-01T00:00:00.000Z')
const rating = {
  id: 5,
  patch_id: 10,
  user_id: 7,
  recommend: 'yes',
  overall: 8,
  play_status: 'finished_main',
  short_summary: 'summary',
  spoiler_level: 'none',
  status: 0,
  created,
  updated: created,
  patch: { unique_id: 'patch-10' },
  user: { id: 7, name: 'user', avatar: 'avatar' },
  _count: { like: 0 },
  like: []
}

beforeEach(() => {
  vi.clearAllMocks()
  events.length = 0
  createMock.mockResolvedValue(rating)
  updateMock.mockResolvedValue(rating)
  deleteMock.mockResolvedValue(rating)
  preScreenTextMock.mockResolvedValue({
    queue: false,
    intercept: false,
    dryRun: false
  })
  hasPendingModerationMock.mockResolvedValue(false)
  createModerationTaskMock.mockResolvedValue(undefined)
  deletePendingModerationTasksMock.mockResolvedValue(undefined)
  collectPendingReportIdsMock.mockResolvedValue([])
  deleteReportsByIdsMock.mockResolvedValue(undefined)
  transactionMock.mockImplementation(
    async (callback: (tx: typeof transactionClient) => Promise<unknown>) => {
      events.push('transaction-start')
      try {
        const result = await callback(transactionClient)
        events.push('transaction-commit')
        return result
      } catch (error) {
        events.push('transaction-rollback')
        throw error
      }
    }
  )
  recomputeOneMock.mockImplementation(
    async (patchId: number, tx: typeof transactionClient) => {
      expect(patchId).toBe(10)
      expect(tx).toBe(transactionClient)
      events.push('recompute')
    }
  )
})

describe('public patch rating write transactions', () => {
  it('recomputes rating stats before the create transaction commits', async () => {
    findUniqueMock.mockResolvedValueOnce(null)

    await createPatchRating(createInput, 7, 2)

    expect(recomputeOneMock).toHaveBeenCalledWith(10, transactionClient)
    expect(events).toEqual([
      'transaction-start',
      'recompute',
      'transaction-commit'
    ])
  })

  it('recomputes rating stats before the update transaction commits', async () => {
    findUniqueMock.mockResolvedValueOnce(rating)

    await updatePatchRating(updateInput, 7, 1)

    expect(recomputeOneMock).toHaveBeenCalledWith(10, transactionClient)
    expect(events).toEqual([
      'transaction-start',
      'recompute',
      'transaction-commit'
    ])
  })

  it('recomputes rating stats before the delete transaction commits', async () => {
    findUniqueMock.mockResolvedValueOnce(rating)

    await deletePatchRating({ ratingId: 5 }, 7, 1)

    expect(recomputeOneMock).toHaveBeenCalledWith(10, transactionClient)
    // 举报外键 SET NULL: 主键在删除前收集 (无锁), 删除后按主键清理 (锁序一致)
    expect(collectPendingReportIdsMock).toHaveBeenCalledWith(
      'rating',
      5,
      transactionClient
    )
    expect(
      collectPendingReportIdsMock.mock.invocationCallOrder[0]
    ).toBeLessThan(deleteMock.mock.invocationCallOrder[0])
    expect(deleteMock.mock.invocationCallOrder[0]).toBeLessThan(
      deleteReportsByIdsMock.mock.invocationCallOrder[0]
    )
    expect(events).toEqual([
      'transaction-start',
      'recompute',
      'transaction-commit'
    ])
  })

  it('rolls back create when rating-stat recomputation fails', async () => {
    findUniqueMock.mockResolvedValueOnce(null)
    recomputeOneMock.mockRejectedValueOnce(new Error('rating stat failed'))

    await expect(createPatchRating(createInput, 7, 2)).rejects.toThrow(
      'rating stat failed'
    )
    expect(events).toEqual(['transaction-start', 'transaction-rollback'])
  })

  it('创建评价时把调用者角色透传给审核预筛', async () => {
    findUniqueMock.mockResolvedValueOnce(null)

    await createPatchRating(createInput, 7, 3)

    expect(preScreenTextMock).toHaveBeenCalledWith('summary', 3)
  })
})
