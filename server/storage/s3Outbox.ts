import { prisma } from '~/prisma/index'
import type { Prisma } from '~/prisma/generated/prisma/client'
import { deleteFileFromS3 } from '~/lib/s3'
import { withTaskLock } from '~/server/tasks/withTaskLock'

const OUTBOX_DRAIN_BATCH_SIZE = 200
const OUTBOX_LOCK_KEY = 's3:deletion:outbox:lock'
const OUTBOX_LOCK_TTL_SECONDS = 300

// 删除写出箱入队：把待删除的 S3 key 持久化到出箱。client 传业务行删除所在事务的 tx，
// 使入队与删除原子提交——提交后即便进程崩溃，删除意图也已落库，由 worker 兜底删除，
// 关闭原「提交后 Promise.all 删 S3、崩溃即丢失内存中 key」的不可恢复窗口。
// s3_key 主键 + skipDuplicates：同 key 重复入队幂等合并为一行。
export const enqueueS3Deletion = async (
  client: Prisma.TransactionClient,
  keys: string[]
) => {
  if (keys.length === 0) {
    return
  }
  await client.s3_deletion_outbox.createMany({
    data: keys.map((s3_key) => ({ s3_key })),
    skipDuplicates: true
  })
}

// 单一消费者：加锁保证任意时刻只有一个 drain 在跑（即时 kick 与定时任务共用同锁）。
// 逐行 DeleteObject（幂等），成功即删行；失败累加 attempts 并滞留，等下一轮重试——
// 至少一次投递，绝不因单次 S3 抖动或部分失败丢失删除意图。
export const drainS3DeletionOutbox = async () => {
  await withTaskLock(
    {
      key: OUTBOX_LOCK_KEY,
      ttlSeconds: OUTBOX_LOCK_TTL_SECONDS,
      taskName: 's3DeletionOutboxDrain'
    },
    async (renew) => {
      const rows = await prisma.s3_deletion_outbox.findMany({
        orderBy: { updated: 'asc' },
        take: OUTBOX_DRAIN_BATCH_SIZE,
        select: { s3_key: true }
      })

      for (const row of rows) {
        try {
          await deleteFileFromS3(row.s3_key)
          await prisma.s3_deletion_outbox.deleteMany({
            where: { s3_key: row.s3_key }
          })
        } catch (error) {
          // 失败不删行、累加 attempts 待下一轮重试。updateMany 会隐式刷新 @updatedAt，
          // 使失败行在 orderBy(updated asc) 中沉到队尾——反复失败的行不会卡队头阻塞新
          // 入队行 (与 search_outbox「失败完全不碰行」有意不同：此处有 attempts 字段必
          // 写库，顺带得到「最久未重试优先」的沉底调度，无饥饿)
          await prisma.s3_deletion_outbox
            .updateMany({
              where: { s3_key: row.s3_key },
              data: { attempts: { increment: 1 } }
            })
            .catch(() => undefined)
          console.error(
            `S3 删除写出箱处理 ${row.s3_key} 失败，保留待下轮重试:`,
            error
          )
        }
        // 每处理一行续锁：drain 活跃期间租约不过期，杜绝锁 TTL 过期后第二个 drain 并发
        await renew()
      }
    }
  )
}

// 即时消费：入队后立刻尝试 drain 一次，保持近实时删除；抢不到锁则由定时任务兜底。
export const kickS3DeletionDrain = () => {
  void drainS3DeletionOutbox().catch((error) => {
    console.error('S3 删除写出箱即时消费失败:', error)
  })
}
