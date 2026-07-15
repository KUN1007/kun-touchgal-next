import cron from 'node-cron'
import { drainS3DeletionOutbox } from '~/server/storage/s3Outbox'

// drainS3DeletionOutbox 内部已用 withTaskLock 保证单一消费者，无需在此重复加锁。
export const s3DeletionOutboxTask = cron.createTask('* * * * *', async () => {
  await drainS3DeletionOutbox().catch((error) => {
    console.error('S3 删除写出箱定时消费失败:', error)
  })
})
