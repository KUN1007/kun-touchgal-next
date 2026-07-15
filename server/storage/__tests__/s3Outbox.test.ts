import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  outboxFindManyMock,
  outboxDeleteManyMock,
  outboxUpdateManyMock,
  outboxCreateManyMock,
  deleteFileFromS3Mock,
  withTaskLockMock
} = vi.hoisted(() => ({
  outboxFindManyMock: vi.fn(),
  outboxDeleteManyMock: vi.fn(),
  outboxUpdateManyMock: vi.fn(),
  outboxCreateManyMock: vi.fn(),
  deleteFileFromS3Mock: vi.fn(),
  withTaskLockMock: vi.fn()
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    s3_deletion_outbox: {
      findMany: outboxFindManyMock,
      deleteMany: outboxDeleteManyMock,
      updateMany: outboxUpdateManyMock,
      createMany: outboxCreateManyMock
    }
  }
}))

vi.mock('~/lib/s3', () => ({
  deleteFileFromS3: deleteFileFromS3Mock
}))

// withTaskLock 直接执行传入的任务体，聚焦 drain 逻辑本身
vi.mock('~/server/tasks/withTaskLock', () => ({
  withTaskLock: withTaskLockMock
}))

import {
  enqueueS3Deletion,
  drainS3DeletionOutbox,
  kickS3DeletionDrain
} from '~/server/storage/s3Outbox'

// setImmediate 在微任务队列排空后触发，足以让 kick 的 fire-and-forget drain 结算
const flush = () => new Promise((resolve) => setImmediate(resolve))

beforeEach(() => {
  outboxFindManyMock.mockReset().mockResolvedValue([])
  outboxDeleteManyMock.mockReset().mockResolvedValue({ count: 1 })
  outboxUpdateManyMock.mockReset().mockResolvedValue({ count: 1 })
  outboxCreateManyMock.mockReset().mockResolvedValue({ count: 0 })
  deleteFileFromS3Mock.mockReset().mockResolvedValue(undefined)
  withTaskLockMock
    .mockReset()
    .mockImplementation(
      (_opts, task: (renew: () => Promise<void>) => Promise<unknown>) =>
        task(async () => {})
    )
})

describe('enqueueS3Deletion 事务性入队', () => {
  it('对传入的 client（事务 tx）createMany 且 skipDuplicates', async () => {
    const txCreateMany = vi.fn().mockResolvedValue({ count: 2 })
    const tx = { s3_deletion_outbox: { createMany: txCreateMany } } as never

    await enqueueS3Deletion(tx, ['a', 'b'])

    expect(txCreateMany).toHaveBeenCalledWith({
      data: [{ s3_key: 'a' }, { s3_key: 'b' }],
      skipDuplicates: true
    })
    // 未落到顶层 prisma：证明入队参与调用方事务、与行删除原子提交
    expect(outboxCreateManyMock).not.toHaveBeenCalled()
  })

  it('空 keys 时不触库', async () => {
    const txCreateMany = vi.fn()
    const tx = { s3_deletion_outbox: { createMany: txCreateMany } } as never

    await enqueueS3Deletion(tx, [])

    expect(txCreateMany).not.toHaveBeenCalled()
  })
})

describe('drainS3DeletionOutbox 单消费者 + 幂等删除', () => {
  it('成功删除对象后移除出箱行', async () => {
    outboxFindManyMock.mockResolvedValue([{ s3_key: 'k1' }])

    await drainS3DeletionOutbox()

    expect(deleteFileFromS3Mock).toHaveBeenCalledWith('k1')
    expect(outboxDeleteManyMock).toHaveBeenCalledWith({
      where: { s3_key: 'k1' }
    })
    expect(outboxUpdateManyMock).not.toHaveBeenCalled()
  })

  it('删除失败的行不移除、累加 attempts 滞留待下一轮', async () => {
    outboxFindManyMock.mockResolvedValue([{ s3_key: 'k1' }])
    deleteFileFromS3Mock.mockRejectedValue(new Error('S3 down'))

    await drainS3DeletionOutbox()

    expect(outboxDeleteManyMock).not.toHaveBeenCalled()
    expect(outboxUpdateManyMock).toHaveBeenCalledWith({
      where: { s3_key: 'k1' },
      data: { attempts: { increment: 1 } }
    })
  })

  it('一行失败不阻断其余行处理', async () => {
    outboxFindManyMock.mockResolvedValue([{ s3_key: 'k1' }, { s3_key: 'k2' }])
    deleteFileFromS3Mock
      .mockRejectedValueOnce(new Error('S3 down'))
      .mockResolvedValueOnce(undefined)

    await drainS3DeletionOutbox()

    expect(outboxDeleteManyMock).toHaveBeenCalledTimes(1)
    expect(outboxDeleteManyMock).toHaveBeenCalledWith({
      where: { s3_key: 'k2' }
    })
  })
})

describe('kickS3DeletionDrain 即时消费', () => {
  it('fire-and-forget 触发一次 drain', async () => {
    kickS3DeletionDrain()
    await flush()

    expect(withTaskLockMock).toHaveBeenCalledTimes(1)
  })
})
