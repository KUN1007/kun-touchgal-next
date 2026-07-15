import cron from 'node-cron'
import { drainSearchOutbox } from '~/server/search/sync'

// 每分钟兜底消费搜索写出箱：即时 kick 抢不到锁、或崩溃 worker 遗留的行在此被拉起重试。
// drainSearchOutbox 内部已用 withTaskLock 保证单一消费者，无需在此重复加锁。
export const searchOutboxTask = cron.createTask('* * * * *', async () => {
  await drainSearchOutbox().catch((error) => {
    console.error('搜索写出箱定时消费失败:', error)
  })
})
