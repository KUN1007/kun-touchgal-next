import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  kunParsePostBodyMock,
  verifyHeaderCookieMock,
  findReportMock,
  transactionMock,
  findRelatedReportsMock,
  deleteRatingMock,
  updateReportsMock,
  createMessagesMock,
  recomputeOneMock
} = vi.hoisted(() => ({
  kunParsePostBodyMock: vi.fn(),
  verifyHeaderCookieMock: vi.fn(),
  findReportMock: vi.fn(),
  transactionMock: vi.fn(),
  findRelatedReportsMock: vi.fn(),
  deleteRatingMock: vi.fn(),
  updateReportsMock: vi.fn(),
  createMessagesMock: vi.fn(),
  recomputeOneMock: vi.fn()
}))

const events: string[] = []
let recomputeStarted: Promise<void>
let finishRecompute: () => void
const transactionClient = {
  patch_report: {
    findMany: findRelatedReportsMock,
    updateMany: updateReportsMock
  },
  patch_rating: { deleteMany: deleteRatingMock },
  user_message: { createMany: createMessagesMock }
}

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' }
      })
  }
}))

vi.mock('~/app/api/utils/parseQuery', () => ({
  kunParsePostBody: kunParsePostBodyMock
}))

vi.mock('~/middleware/_verifyHeaderCookie', () => ({
  verifyHeaderCookie: verifyHeaderCookieMock
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_report: { findUnique: findReportMock },
    $transaction: transactionMock
  }
}))

vi.mock('~/app/api/patch/rating/stat', () => ({
  recomputePatchRatingStat: recomputeOneMock
}))

import { POST } from '~/app/api/admin/report/handle/route'

const request = new Request('http://localhost/api/admin/report/handle', {
  method: 'POST'
}) as unknown as Parameters<typeof POST>[0]

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
  kunParsePostBodyMock.mockResolvedValue({
    reportId: 1,
    action: 'delete',
    content: ''
  })
  verifyHeaderCookieMock.mockResolvedValue({ uid: 99, role: 4 })
  findReportMock.mockResolvedValue({
    id: 1,
    status: 0,
    target_type: 'rating',
    reason: 'spam',
    comment_id: null,
    rating_id: 5,
    patch_id: 10
  })
  findRelatedReportsMock.mockResolvedValue([
    { id: 1, sender_id: 7, reason: 'spam' }
  ])
  deleteRatingMock.mockResolvedValue({ count: 1 })
  updateReportsMock.mockResolvedValue({ count: 1 })
  createMessagesMock.mockResolvedValue({ count: 1 })
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

describe('POST /api/admin/report/handle', () => {
  it('deletes a reported rating and recomputes stats before commit', async () => {
    const pendingResponse = POST(request)
    await recomputeStarted
    await Promise.resolve()
    const eventsBeforeRecompute = [...events]
    finishRecompute()
    const response = await pendingResponse

    await expect(response.json()).resolves.toEqual({})
    expect(deleteRatingMock).toHaveBeenCalledWith({ where: { id: 5 } })
    expect(recomputeOneMock).toHaveBeenCalledWith(10, transactionClient)
    expect(deleteRatingMock.mock.invocationCallOrder[0]).toBeLessThan(
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
