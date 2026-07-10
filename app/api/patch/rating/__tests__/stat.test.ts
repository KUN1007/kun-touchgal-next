import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  transactionMock,
  executeRawMock,
  queryRawMock,
  aggregateMock,
  countMock,
  upsertMock
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  executeRawMock: vi.fn(),
  queryRawMock: vi.fn(),
  aggregateMock: vi.fn(),
  countMock: vi.fn(),
  upsertMock: vi.fn()
}))

const transactionClient = {
  $executeRaw: executeRawMock,
  $queryRaw: queryRawMock,
  patch_rating: {
    aggregate: aggregateMock,
    count: countMock
  },
  patch_rating_stat: {
    upsert: upsertMock
  }
}

vi.mock('~/prisma/index', () => ({
  prisma: {
    $transaction: transactionMock
  }
}))

import { recomputePatchRatingStat } from '~/app/api/patch/rating/stat'

const ratingStat = {
  avg_overall: 5.5,
  count: 4,
  rec_strong_no: 2,
  rec_no: 0,
  rec_neutral: 0,
  rec_yes: 2,
  rec_strong_yes: 0,
  o1: 0,
  o2: 2,
  o3: 0,
  o4: 0,
  o5: 0,
  o6: 0,
  o7: 0,
  o8: 1,
  o9: 0,
  o10: 1
}

const emptyRatingStat = {
  ...ratingStat,
  avg_overall: 0,
  count: 0,
  rec_strong_no: 0,
  rec_yes: 0,
  o2: 0,
  o8: 0,
  o10: 0
}

beforeEach(() => {
  vi.clearAllMocks()
  transactionMock.mockImplementation(
    async (callback: (tx: typeof transactionClient) => Promise<void>) => {
      await callback(transactionClient)
    }
  )
})

describe('recomputePatchRatingStat', () => {
  it('aggregates every rating bucket with one query inside the lock', async () => {
    const lock = Promise.withResolvers<number>()
    executeRawMock.mockReturnValue(lock.promise)
    queryRawMock.mockResolvedValue([ratingStat])
    aggregateMock.mockResolvedValue({
      _avg: { overall: 5.5 },
      _count: { _all: 4 }
    })
    const legacyCounts = [2, 0, 0, 2, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 1]
    legacyCounts.forEach((count) => countMock.mockResolvedValueOnce(count))
    upsertMock.mockResolvedValue({})

    const recompute = recomputePatchRatingStat(42)

    expect(executeRawMock).toHaveBeenCalledTimes(1)
    expect(queryRawMock).not.toHaveBeenCalled()

    lock.resolve(1)
    await recompute

    expect(queryRawMock).toHaveBeenCalledTimes(1)
    expect(aggregateMock).not.toHaveBeenCalled()
    expect(countMock).not.toHaveBeenCalled()

    const [strings, ...parameters] = queryRawMock.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[]
    ]
    const sql = strings.join('?').replace(/\s+/g, ' ').trim()
    expect(parameters).toEqual([42])
    expect(sql).toContain(
      'COALESCE(AVG(overall), 0)::double precision AS avg_overall'
    )
    expect(sql).toContain('COUNT(*)::int AS count')
    ;[
      ['strong_no', 'rec_strong_no'],
      ['no', 'rec_no'],
      ['neutral', 'rec_neutral'],
      ['yes', 'rec_yes'],
      ['strong_yes', 'rec_strong_yes']
    ].forEach(([recommend, field]) => {
      expect(sql).toContain(
        `COUNT(*) FILTER (WHERE recommend = '${recommend}')::int AS ${field}`
      )
    })
    for (let overall = 1; overall <= 10; overall++) {
      expect(sql).toContain(
        `COUNT(*) FILTER (WHERE overall = ${overall})::int AS o${overall}`
      )
    }
    expect(sql).toContain('FROM patch_rating WHERE patch_id = ? AND status = 0')
    expect(upsertMock).toHaveBeenCalledWith({
      where: { patch_id: 42 },
      create: { patch_id: 42, ...ratingStat },
      update: ratingStat
    })
  })

  it('upserts zero statistics when no visible ratings remain', async () => {
    executeRawMock.mockResolvedValue(1)
    queryRawMock.mockResolvedValue([emptyRatingStat])
    upsertMock.mockResolvedValue({})

    await recomputePatchRatingStat(42)

    expect(upsertMock).toHaveBeenCalledWith({
      where: { patch_id: 42 },
      create: { patch_id: 42, ...emptyRatingStat },
      update: emptyRatingStat
    })
  })
})
