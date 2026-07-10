import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  findAdminMock,
  findAppealMock,
  findRatingMock,
  transactionMock,
  claimAppealMock,
  updateRatingMock,
  createMessageMock,
  createLogMock,
  recomputeOneMock
} = vi.hoisted(() => ({
  findAdminMock: vi.fn(),
  findAppealMock: vi.fn(),
  findRatingMock: vi.fn(),
  transactionMock: vi.fn(),
  claimAppealMock: vi.fn(),
  updateRatingMock: vi.fn(),
  createMessageMock: vi.fn(),
  createLogMock: vi.fn(),
  recomputeOneMock: vi.fn()
}))

const events: string[] = []
let recomputeStarted: Promise<void>
let finishRecompute: () => void
const transactionClient = {
  moderation_appeal: { updateMany: claimAppealMock },
  patch_rating: { updateMany: updateRatingMock },
  admin_log: { create: createLogMock }
}

vi.mock('~/prisma/index', () => ({
  prisma: {
    user: { findUnique: findAdminMock },
    moderation_appeal: { findUnique: findAppealMock },
    patch_rating: { findUnique: findRatingMock },
    $transaction: transactionMock
  }
}))

vi.mock('~/app/api/utils/message', () => ({
  createMessage: createMessageMock
}))

vi.mock('~/app/api/patch/rating/stat', () => ({
  recomputePatchRatingStat: recomputeOneMock
}))

import { handleAppeal } from '~/app/api/admin/appeal/handle'

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
  findAppealMock.mockResolvedValue({
    id: 1,
    content_type: 'rating',
    content_id: 5,
    user_id: 7,
    status: 'pending',
    payload: { text: 'restored' }
  })
  findRatingMock.mockResolvedValue({ patch_id: 10 })
  claimAppealMock.mockResolvedValue({ count: 1 })
  updateRatingMock.mockResolvedValue({ count: 1 })
  createMessageMock.mockResolvedValue({})
  createLogMock.mockResolvedValue({})
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

describe('handleAppeal', () => {
  it('recomputes rating stats before an approval transaction commits', async () => {
    const result = handleAppeal({ appealId: 1, approve: true }, 99)
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
