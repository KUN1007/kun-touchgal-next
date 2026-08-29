import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  relationFindManyMock,
  tagFindManyMock,
  txQueryRawMock,
  txTagCreateManyMock,
  txTagFindManyMock,
  txRelationCreateManyMock,
  txRelationDeleteManyMock
} = vi.hoisted(() => ({
  relationFindManyMock: vi.fn(),
  tagFindManyMock: vi.fn(),
  txQueryRawMock: vi.fn(),
  txTagCreateManyMock: vi.fn(),
  txTagFindManyMock: vi.fn(),
  txRelationCreateManyMock: vi.fn(),
  txRelationDeleteManyMock: vi.fn()
}))

const tx = {
  $queryRaw: txQueryRawMock,
  patch_tag: {
    createMany: txTagCreateManyMock,
    findMany: txTagFindManyMock
  },
  patch_tag_relation: {
    createMany: txRelationCreateManyMock,
    deleteMany: txRelationDeleteManyMock
  }
}

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_tag_relation: {
      findMany: relationFindManyMock
    },
    patch_tag: {
      findMany: tagFindManyMock
    },
    $transaction: (cb: (tx: unknown) => Promise<unknown>) => cb(tx)
  }
}))

import { handleBatchPatchTags } from '~/app/api/edit/batchTag'

beforeEach(() => {
  vi.resetAllMocks()
  relationFindManyMock.mockResolvedValue([])
  tagFindManyMock.mockResolvedValue([])
  txQueryRawMock.mockResolvedValue([])
  txTagCreateManyMock.mockResolvedValue({ count: 0 })
  txTagFindManyMock.mockResolvedValue([])
  txRelationCreateManyMock.mockResolvedValue({ count: 0 })
  txRelationDeleteManyMock.mockResolvedValue({ count: 0 })
})

describe('handleBatchPatchTags', () => {
  it('换标签时事务首条对 existing ∪ remove 并集升序预加锁', async () => {
    relationFindManyMock.mockResolvedValue([
      { tag_id: 10, tag: { name: 'tag-old' } }
    ])
    tagFindManyMock.mockResolvedValue([{ id: 50, name: 'tag-add' }])

    const result = await handleBatchPatchTags(1, ['tag-add'], 7)

    expect(txQueryRawMock).toHaveBeenCalledTimes(1)
    const [strings, lockIds] = txQueryRawMock.mock.calls[0]
    expect(strings.join('$ids')).toContain('FOR NO KEY UPDATE')
    expect(strings.join('$ids')).toContain('ORDER BY id')
    // 拼接顺序为 [50, 10]，断言升序排序生效
    expect(lockIds).toEqual([10, 50])

    // 预锁必须先于关系表写入（触发器锁在这两条语句内获取）
    expect(txQueryRawMock.mock.invocationCallOrder[0]).toBeLessThan(
      txRelationCreateManyMock.mock.invocationCallOrder[0]
    )
    expect(txQueryRawMock.mock.invocationCallOrder[0]).toBeLessThan(
      txRelationDeleteManyMock.mock.invocationCallOrder[0]
    )

    expect(txRelationCreateManyMock).toHaveBeenCalledWith({
      data: [{ patch_id: 1, tag_id: 50 }],
      skipDuplicates: true
    })
    expect(txRelationDeleteManyMock).toHaveBeenCalledWith({
      where: { patch_id: 1, tag_id: { in: [10] } }
    })
    expect(result).toEqual({ success: true, changed: true })
  })

  it('纯新建 tag 不预加锁（未提交新行对并发不可见）', async () => {
    txTagFindManyMock.mockResolvedValue([{ id: 99, name: 'brand-new' }])

    const result = await handleBatchPatchTags(1, ['brand-new'], 7)

    expect(txQueryRawMock).not.toHaveBeenCalled()
    expect(txTagCreateManyMock).toHaveBeenCalledWith({
      data: [{ user_id: 7, name: 'brand-new', source: 'self' }]
    })
    expect(txRelationCreateManyMock).toHaveBeenCalledWith({
      data: [{ patch_id: 1, tag_id: 99 }],
      skipDuplicates: true
    })
    expect(txRelationDeleteManyMock).not.toHaveBeenCalled()
    expect(result).toEqual({ success: true, changed: true })
  })

  it('输入命中已关联标签的别名时不新建重复标签也不删关联', async () => {
    relationFindManyMock.mockResolvedValue([
      { tag_id: 10, tag: { name: '寝取られ' } }
    ])
    tagFindManyMock.mockResolvedValue([
      { id: 10, name: '寝取られ', alias: ['NTR'] }
    ])

    const result = await handleBatchPatchTags(1, ['寝取られ', 'NTR'], 7)

    expect(txTagCreateManyMock).not.toHaveBeenCalled()
    expect(txRelationCreateManyMock).toHaveBeenCalledWith({
      data: [{ patch_id: 1, tag_id: 10 }],
      skipDuplicates: true
    })
    expect(txRelationDeleteManyMock).not.toHaveBeenCalled()
    expect(result).toEqual({ success: true, changed: true })
  })

  it('用别名替换名字提交时规范标签不进删除集', async () => {
    relationFindManyMock.mockResolvedValue([
      { tag_id: 10, tag: { name: '寝取られ' } }
    ])
    tagFindManyMock.mockResolvedValue([
      { id: 10, name: '寝取られ', alias: ['NTR'] }
    ])

    const result = await handleBatchPatchTags(1, ['NTR'], 7)

    expect(txTagCreateManyMock).not.toHaveBeenCalled()
    expect(txRelationCreateManyMock).toHaveBeenCalledWith({
      data: [{ patch_id: 1, tag_id: 10 }],
      skipDuplicates: true
    })
    expect(txRelationDeleteManyMock).not.toHaveBeenCalled()
    expect(result).toEqual({ success: true, changed: true })
  })

  it('输入未关联标签的别名时只关联规范标签', async () => {
    tagFindManyMock.mockResolvedValue([
      { id: 20, name: '寝取られ', alias: ['NTR'] }
    ])

    const result = await handleBatchPatchTags(1, ['NTR'], 7)

    expect(txTagCreateManyMock).not.toHaveBeenCalled()
    expect(txRelationCreateManyMock).toHaveBeenCalledWith({
      data: [{ patch_id: 1, tag_id: 20 }],
      skipDuplicates: true
    })
    expect(result).toEqual({ success: true, changed: true })
  })

  it('输入同时是 A 的别名与 B 的名字时按名字优先解析', async () => {
    tagFindManyMock.mockResolvedValue([
      { id: 30, name: 'other', alias: ['X'] },
      { id: 31, name: 'X', alias: [] }
    ])

    await handleBatchPatchTags(1, ['X'], 7)

    expect(txTagCreateManyMock).not.toHaveBeenCalled()
    expect(txRelationCreateManyMock).toHaveBeenCalledWith({
      data: [{ patch_id: 1, tag_id: 31 }],
      skipDuplicates: true
    })
  })

  it('标签无变化时不加锁不写库', async () => {
    relationFindManyMock.mockResolvedValue([
      { tag_id: 10, tag: { name: 'tag-old' } }
    ])

    const result = await handleBatchPatchTags(1, ['tag-old'], 7)

    expect(txQueryRawMock).not.toHaveBeenCalled()
    expect(txTagCreateManyMock).not.toHaveBeenCalled()
    expect(txRelationCreateManyMock).not.toHaveBeenCalled()
    expect(txRelationDeleteManyMock).not.toHaveBeenCalled()
    expect(result).toEqual({ success: true, changed: false })
  })
})
