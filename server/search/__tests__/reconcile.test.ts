import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  patchFindManyMock,
  getMeiliClientMock,
  getDocumentsMock,
  deleteDocumentsMock,
  addDocumentsMock,
  waitTaskMock,
  patchToSearchDocMock
} = vi.hoisted(() => ({
  patchFindManyMock: vi.fn(),
  getMeiliClientMock: vi.fn(),
  getDocumentsMock: vi.fn(),
  deleteDocumentsMock: vi.fn(),
  addDocumentsMock: vi.fn(),
  waitTaskMock: vi.fn(),
  patchToSearchDocMock: vi.fn()
}))

vi.mock('~/prisma/index', () => ({
  prisma: { patch: { findMany: patchFindManyMock } }
}))

vi.mock('~/lib/meilisearch', () => ({
  getMeiliClient: getMeiliClientMock
}))

vi.mock('~/server/search/document', () => ({
  PATCH_SEARCH_SELECT: {},
  patchToSearchDoc: patchToSearchDocMock
}))

import { reconcileSearchIndex } from '~/server/search/reconcile'

// updated 存为 Unix 秒；构造 Date 使其 epoch 秒等于给定值，便于与索引侧比对
const t = (sec: number) => new Date(sec * 1000)

describe('reconcileSearchIndex keyset 分批加载 PG', () => {
  beforeEach(() => {
    patchFindManyMock.mockReset()
    getDocumentsMock.mockReset()
    deleteDocumentsMock.mockReset().mockReturnValue({ waitTask: waitTaskMock })
    addDocumentsMock.mockReset().mockReturnValue({ waitTask: waitTaskMock })
    waitTaskMock.mockReset().mockResolvedValue({ status: 'succeeded' })
    patchToSearchDocMock.mockReset()
    getMeiliClientMock.mockReset().mockReturnValue({
      index: () => ({
        getDocuments: getDocumentsMock,
        deleteDocuments: deleteDocumentsMock,
        addDocuments: addDocumentsMock
      })
    })
  })

  it('跨批全部并入、游标随批推进、纯删除索引多余项', async () => {
    // PG 分三批返回，末批空数组终止循环
    patchFindManyMock
      .mockResolvedValueOnce([
        { id: 1, updated: t(100) },
        { id: 2, updated: t(100) }
      ])
      .mockResolvedValueOnce([{ id: 3, updated: t(100) }])
      .mockResolvedValueOnce([])
    // 索引侧含 PG 不存在的 id=4；其余时间戳与 PG 持平（不触发同步）
    getDocumentsMock.mockResolvedValue({
      results: [
        { id: 1, updated: 100 },
        { id: 2, updated: 100 },
        { id: 3, updated: 100 },
        { id: 4, updated: 100 }
      ],
      total: 4
    })

    const result = await reconcileSearchIndex()

    // total=3 证明第二、三批也并入了 Map：若漏读后批，id=3 会被误判为索引多余项
    expect(result.total).toBe(3)
    expect(result.deleted).toBe(1)
    expect(result.synced).toBe(0)
    expect(deleteDocumentsMock).toHaveBeenCalledWith([4])
    expect(addDocumentsMock).not.toHaveBeenCalled()
    // 游标随批推进：gt 依次为上一批最大 id
    expect(patchFindManyMock.mock.calls[0][0].where).toEqual({ id: { gt: 0 } })
    expect(patchFindManyMock.mock.calls[1][0].where).toEqual({ id: { gt: 2 } })
    expect(patchFindManyMock.mock.calls[2][0].where).toEqual({ id: { gt: 3 } })
    // 对齐兄弟范式：orderBy id asc + 有界 take
    expect(patchFindManyMock.mock.calls[0][0].orderBy).toEqual({ id: 'asc' })
    expect(patchFindManyMock.mock.calls[0][0].take).toBe(1000)
  })

  it('PG 比索引新时按 id 分批取全量文档并写入', async () => {
    // keyset 走 where.id.gt，sync 取数走 where.id.in，用 where 形状区分
    patchFindManyMock.mockImplementation(
      (args: { where?: { id?: { gt?: number; in?: number[] } } }) => {
        if (args.where?.id?.in) {
          return Promise.resolve([{ id: 1, updated: t(200) }])
        }
        if (args.where?.id?.gt === 0) {
          return Promise.resolve([{ id: 1, updated: t(200) }])
        }
        return Promise.resolve([])
      }
    )
    // 索引侧 id=1 落后于 PG（100 < 200）→ 需同步
    getDocumentsMock.mockResolvedValue({
      results: [{ id: 1, updated: 100 }],
      total: 1
    })
    patchToSearchDocMock.mockResolvedValue({ id: 1 })

    const result = await reconcileSearchIndex()

    expect(result.synced).toBe(1)
    expect(result.deleted).toBe(0)
    expect(deleteDocumentsMock).not.toHaveBeenCalled()
    expect(addDocumentsMock).toHaveBeenCalledWith([{ id: 1 }])
    const syncCall = patchFindManyMock.mock.calls.find(
      (c) => c[0].where?.id?.in
    )
    expect(syncCall?.[0].where.id.in).toEqual([1])
  })

  it('大批同步跨多个构建子块仍聚合进单次写入批, 拼接透传行序不重排', async () => {
    // 120 > DOC_BUILD_CHUNK_SIZE(50): 强制 doc 构建切成多个子块并让出事件循环
    const ids = Array.from({ length: 120 }, (_, i) => i + 1)
    // 模拟 Postgres 对 IN 查询不保证返回序: 用非单调乱序(偶数升序在前、奇数升序在
    // 后)回 rows, 证明子块拼接原样透传 findMany 返回序、不重排。生产按 Meili id
    // upsert 不依赖顺序, 此处仅锁定拼接逻辑本身
    const scrambled = [
      ...ids.filter((id) => id % 2 === 0),
      ...ids.filter((id) => id % 2 === 1)
    ]
    patchFindManyMock.mockImplementation(
      (args: { where?: { id?: { gt?: number; in?: number[] } } }) => {
        if (args.where?.id?.in) {
          return Promise.resolve(
            scrambled.map((id) => ({ id, updated: t(200) }))
          )
        }
        if (args.where?.id?.gt === 0) {
          return Promise.resolve(ids.map((id) => ({ id, updated: t(200) })))
        }
        return Promise.resolve([])
      }
    )
    // 索引侧为空 → 120 条全部落后需同步
    getDocumentsMock.mockResolvedValue({ results: [], total: 0 })
    patchToSearchDocMock.mockImplementation((p: { id: number }) =>
      Promise.resolve({ id: p.id })
    )

    const result = await reconcileSearchIndex()

    expect(result.synced).toBe(120)
    expect(result.deleted).toBe(0)
    // 120 < RECONCILE_BATCH_SIZE(1000): 多个构建子块聚合成一次 addDocuments, 写入边界不变
    expect(addDocumentsMock).toHaveBeenCalledTimes(1)
    const written = addDocumentsMock.mock.calls[0][0] as { id: number }[]
    expect(written).toHaveLength(120)
    // 输出顺序 == findMany 实际返回序(乱序): 子块拼接不重排; 重排型 bug 会在此被抓
    expect(written.map((d) => d.id)).toEqual(scrambled)
    expect(patchToSearchDocMock).toHaveBeenCalledTimes(120)
  })

  it('空表时首查即以 gt 0 起、单次即终止，无删除无同步', async () => {
    patchFindManyMock.mockResolvedValueOnce([])
    getDocumentsMock.mockResolvedValue({ results: [], total: 0 })

    const result = await reconcileSearchIndex()

    expect(result).toEqual({ total: 0, synced: 0, deleted: 0 })
    expect(patchFindManyMock).toHaveBeenCalledTimes(1)
    expect(patchFindManyMock.mock.calls[0][0].where).toEqual({ id: { gt: 0 } })
    expect(deleteDocumentsMock).not.toHaveBeenCalled()
    expect(addDocumentsMock).not.toHaveBeenCalled()
  })

  it('未配置 Meili 时抛错且不触碰数据库', async () => {
    getMeiliClientMock.mockReturnValue(null)

    await expect(reconcileSearchIndex()).rejects.toThrow('未配置')
    expect(patchFindManyMock).not.toHaveBeenCalled()
  })
})
