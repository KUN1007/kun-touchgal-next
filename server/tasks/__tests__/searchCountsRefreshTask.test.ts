import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GalgameSearchCountsDoc } from '~/server/search/document'

const {
  patchFindManyMock,
  updateDocumentsMock,
  waitTaskMock,
  getMeiliClientMock,
  getKvHashAllMock,
  setKvHashFieldsMock
} = vi.hoisted(() => ({
  patchFindManyMock: vi.fn(),
  updateDocumentsMock: vi.fn(),
  waitTaskMock: vi.fn(),
  getMeiliClientMock: vi.fn(),
  getKvHashAllMock: vi.fn(),
  setKvHashFieldsMock: vi.fn()
}))

vi.mock('~/prisma', () => ({
  prisma: { patch: { findMany: patchFindManyMock } }
}))

vi.mock('~/lib/meilisearch', () => ({
  getMeiliClient: getMeiliClientMock
}))

vi.mock('~/lib/redis', () => ({
  getKvHashAll: getKvHashAllMock,
  setKvHashFields: setKvHashFieldsMock
}))

import {
  refreshSearchCounts,
  countsFingerprint
} from '~/server/tasks/searchCountsRefreshTask'

interface PatchCountsRow {
  id: number
  view: number
  download: number
  favorite_count: number
  resource_count: number
  comment_count: number
  rating_stat: { avg_overall: number; count: number } | null
}

const makeRow = (
  id: number,
  overrides: Partial<PatchCountsRow> = {}
): PatchCountsRow => ({
  id,
  view: 10,
  download: 5,
  favorite_count: 2,
  resource_count: 1,
  comment_count: 3,
  rating_stat: { avg_overall: 8, count: 4 },
  ...overrides
})

const docOf = (row: PatchCountsRow): GalgameSearchCountsDoc => ({
  id: row.id,
  view: row.view,
  download: row.download,
  favoriteCount: row.favorite_count,
  resourceCount: row.resource_count,
  commentCount: row.comment_count,
  ratingCount: row.rating_stat?.count ?? 0,
  avgRating: row.rating_stat?.avg_overall ?? 0
})

const fpOf = (row: PatchCountsRow) => countsFingerprint(docOf(row))

// findMany 是游标分页：先返回给定批次，再返回空数组终止循环
const mockRowsOnce = (rows: PatchCountsRow[]) => {
  patchFindManyMock.mockResolvedValueOnce(rows).mockResolvedValueOnce([])
}

const pushedDocs = (call: number): GalgameSearchCountsDoc[] =>
  updateDocumentsMock.mock.calls[call][0]

describe('refreshSearchCounts 快照 diff', () => {
  beforeEach(() => {
    patchFindManyMock.mockReset()
    updateDocumentsMock.mockReset().mockReturnValue({ waitTask: waitTaskMock })
    waitTaskMock.mockReset().mockResolvedValue({ status: 'succeeded' })
    getKvHashAllMock.mockReset().mockResolvedValue({})
    setKvHashFieldsMock.mockReset().mockResolvedValue(undefined)
    getMeiliClientMock.mockReset().mockReturnValue({
      index: () => ({ updateDocuments: updateDocumentsMock })
    })
  })

  it('未配置 Meili 时直接返回，不读库、不读快照', async () => {
    getMeiliClientMock.mockReturnValue(null)

    await refreshSearchCounts()

    expect(patchFindManyMock).not.toHaveBeenCalled()
    expect(getKvHashAllMock).not.toHaveBeenCalled()
  })

  it('快照为空（冷启动）时推送全部行并写回其指纹', async () => {
    getKvHashAllMock.mockResolvedValue({})
    mockRowsOnce([makeRow(1), makeRow(2)])

    await refreshSearchCounts()

    expect(updateDocumentsMock).toHaveBeenCalledTimes(1)
    expect(pushedDocs(0).map((d) => d.id)).toEqual([1, 2])
    expect(setKvHashFieldsMock).toHaveBeenCalledWith('search:counts:fp', {
      '1': fpOf(makeRow(1)),
      '2': fpOf(makeRow(2))
    })
  })

  it('仅推送指纹相较快照发生变化的行，未变行不进 payload', async () => {
    const unchanged = makeRow(1)
    const changed = makeRow(2, { view: 999 })
    // 快照中 id=1 与当前一致（未变），id=2 为旧值（已变）
    getKvHashAllMock.mockResolvedValue({
      '1': fpOf(unchanged),
      '2': fpOf(makeRow(2, { view: 1 }))
    })
    mockRowsOnce([unchanged, changed])

    await refreshSearchCounts()

    expect(updateDocumentsMock).toHaveBeenCalledTimes(1)
    expect(pushedDocs(0).map((d) => d.id)).toEqual([2])
    expect(setKvHashFieldsMock).toHaveBeenCalledWith('search:counts:fp', {
      '2': fpOf(changed)
    })
  })

  it('整批零变更时跳过 Meili 写与快照写', async () => {
    const r1 = makeRow(1)
    const r2 = makeRow(2)
    getKvHashAllMock.mockResolvedValue({ '1': fpOf(r1), '2': fpOf(r2) })
    mockRowsOnce([r1, r2])

    await refreshSearchCounts()

    expect(updateDocumentsMock).not.toHaveBeenCalled()
    expect(setKvHashFieldsMock).not.toHaveBeenCalled()
  })

  it('Meili 批次失败时抛错且不写回快照（保留下轮重推）', async () => {
    waitTaskMock.mockResolvedValue({ status: 'failed', error: { code: 'x' } })
    mockRowsOnce([makeRow(1)])

    await expect(refreshSearchCounts()).rejects.toThrow('计数快照批次写入失败')
    expect(setKvHashFieldsMock).not.toHaveBeenCalled()
  })

  it('指纹覆盖 avgRating/ratingCount 等全部计数字段', async () => {
    const base = makeRow(1)
    const ratingChanged = makeRow(1, {
      rating_stat: { avg_overall: 9, count: 4 }
    })

    expect(fpOf(ratingChanged)).not.toBe(fpOf(base))
  })

  it('跨批处理：逐批 diff、游标随批推进（含未变行）、每批独立推送与写快照', async () => {
    const r1 = makeRow(1, { view: 111 }) // 变
    const r2 = makeRow(2) // 未变（快照命中）
    const r3 = makeRow(3, { download: 77 }) // 变
    getKvHashAllMock.mockResolvedValue({ '2': fpOf(r2) })
    patchFindManyMock
      .mockResolvedValueOnce([r1, r2])
      .mockResolvedValueOnce([r3])
      .mockResolvedValueOnce([])

    await refreshSearchCounts()

    // 每批各推一次，r2 未变被剔除
    expect(updateDocumentsMock).toHaveBeenCalledTimes(2)
    expect(pushedDocs(0).map((d) => d.id)).toEqual([1])
    expect(pushedDocs(1).map((d) => d.id)).toEqual([3])
    // 游标随批推进：即便 r2 未变，lastId 也推进到 2，第三批查 id>3
    expect(patchFindManyMock.mock.calls[1][0].where).toEqual({ id: { gt: 2 } })
    expect(patchFindManyMock.mock.calls[2][0].where).toEqual({ id: { gt: 3 } })
    // 每批独立写回各自变更指纹
    expect(setKvHashFieldsMock).toHaveBeenNthCalledWith(1, 'search:counts:fp', {
      '1': fpOf(r1)
    })
    expect(setKvHashFieldsMock).toHaveBeenNthCalledWith(2, 'search:counts:fp', {
      '3': fpOf(r3)
    })
  })
})
