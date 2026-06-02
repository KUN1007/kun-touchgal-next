import { prisma } from '~/prisma'
import cron from 'node-cron'
import { withTaskLock } from './withTaskLock'
import { invalidateAllUserSessions } from '~/app/api/user/session/cache'

const RESET_DAILY_LOCK_KEY = 'cron:reset-daily:lock'
const RESET_DAILY_LOCK_TTL_SECONDS = 60 * 60

const resetDailyStats = async () => {
  await prisma.user.updateMany({
    data: {
      daily_image_count: 0,
      daily_check_in: 0,
      daily_upload_size: 0
    }
  })
  await invalidateAllUserSessions()
}

export const resetDailyTask = cron.createTask('0 0 * * *', async () => {
  await withTaskLock(
    {
      key: RESET_DAILY_LOCK_KEY,
      ttlSeconds: RESET_DAILY_LOCK_TTL_SECONDS,
      taskName: 'resetDailyTask',
      releaseOnComplete: false
    },
    resetDailyStats
  )
})
