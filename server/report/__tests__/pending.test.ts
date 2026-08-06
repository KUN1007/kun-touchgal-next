import { beforeEach, describe, expect, it, vi } from 'vitest'

const { deleteManyMock } = vi.hoisted(() => ({
  deleteManyMock: vi.fn()
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_report: { deleteMany: deleteManyMock }
  }
}))

import { deleteOrphanReports } from '~/server/report/pending'
import type { Prisma } from '~/prisma/generated/prisma/client'

beforeEach(() => {
  vi.clearAllMocks()
  deleteManyMock.mockResolvedValue({ count: 0 })
})

describe('deleteOrphanReports', () => {
  // 创建路径必填目标 id, 目标为 NULL 的 pending 举报只可能来自级联 SET NULL
  it('comment 目标按 comment_id IS NULL 的 pending 举报清理', async () => {
    await deleteOrphanReports('comment')

    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { target_type: 'comment', status: 0, comment_id: null }
    })
  })

  it('rating 目标按 rating_id IS NULL 的 pending 举报清理', async () => {
    await deleteOrphanReports('rating')

    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { target_type: 'rating', status: 0, rating_id: null }
    })
  })

  it('传入事务客户端时在该客户端上执行', async () => {
    const txDeleteMany = vi.fn(async () => ({ count: 0 }))
    const tx = {
      patch_report: { deleteMany: txDeleteMany }
    } as unknown as Prisma.TransactionClient

    await deleteOrphanReports('comment', tx)

    expect(txDeleteMany).toHaveBeenCalledTimes(1)
    expect(deleteManyMock).not.toHaveBeenCalled()
  })
})
