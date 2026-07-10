import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  findAdminMock,
  findRatingMock,
  transactionMock,
  updateRatingMock,
  createLogMock,
  deleteTasksMock,
  recomputeOneMock
} = vi.hoisted(() => ({
  findAdminMock: vi.fn(),
  findRatingMock: vi.fn(),
  transactionMock: vi.fn(),
  updateRatingMock: vi.fn(),
  createLogMock: vi.fn(),
  deleteTasksMock: vi.fn(),
  recomputeOneMock: vi.fn()
}))

const events: string[] = []
let recomputeStarted: Promise<void>
let finishRecompute: () => void
const transactionClient = {
  patch_rating: { update: updateRatingMock },
  admin_log: { create: createLogMock }
}

vi.mock('~/prisma/index', () => ({
  prisma: {
    user: { findUnique: findAdminMock },
    patch_rating: { findUnique: findRatingMock },
    $transaction: transactionMock
  }
}))

vi.mock('~/app/api/patch/rating/stat', () => ({
  recomputePatchRatingStat: recomputeOneMock
}))

vi.mock('~/server/moderation/submit', () => ({
  deletePendingModerationTasks: deleteTasksMock
}))

import { updateRatingShadowBan } from '~/app/api/admin/rating/shadow-ban/shadowBan'

beforeEach(() => {
  vi.clearAllMocks()
  events.length = 0
  const started = Promise.withResolvers<void>()
  const finished = Promise.withResolvers<void>()
  recomputeStarted = started.promise
  finishRecompute = () => {
    events.push('recompute')
    finished.resolve()
  }
  findAdminMock.mockResolvedValue({ id: 99, name: 'admin' })
  findRatingMock.mockResolvedValue({
    id: 5,
    status: 0,
    patch_id: 10,
    user: { name: 'user' }
  })
  updateRatingMock.mockResolvedValue({})
  createLogMock.mockResolvedValue({})
  deleteTasksMock.mockResolvedValue(undefined)
  transactionMock.mockImplementation(
    async (callback: (tx: typeof transactionClient) => Promise<unknown>) => {
      events.push('transaction-start')
      const result = await callback(transactionClient)
      events.push('transaction-commit')
      return result
    }
  )
  recomputeOneMock.mockImplementation(() => {
    started.resolve()
    return finished.promise
  })
})

describe('updateRatingShadowBan', () => {
  it('recomputes rating stats before the shadow-ban transaction commits', async () => {
    const result = updateRatingShadowBan({ ratingId: 5, status: 2 }, 99)
    await recomputeStarted
    await Promise.resolve()
    const eventsBeforeRecompute = [...events]
    finishRecompute()

    await expect(result).resolves.toEqual({})
    expect(recomputeOneMock).toHaveBeenCalledWith(10, transactionClient)
    expect(updateRatingMock.mock.invocationCallOrder[0]).toBeLessThan(
      recomputeOneMock.mock.invocationCallOrder[0]
    )
    expect(eventsBeforeRecompute).toEqual(['transaction-start'])
    expect(events).toEqual([
      'transaction-start',
      'recompute',
      'transaction-commit'
    ])
  })
})
