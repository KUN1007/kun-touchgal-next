import cron from 'node-cron'
import { getMeiliClient } from '~/lib/meilisearch'
import { reconcileSearchIndex } from '~/server/search/reconcile'
import { withTaskLock } from './withTaskLock'

const SEARCH_RECONCILE_LOCK_KEY = 'search:reconcile:lock'
const SEARCH_RECONCILE_LOCK_TTL_SECONDS = 3600

export const searchReconcileTask = cron.createTask('0 5 * * *', async () => {
  if (!getMeiliClient()) {
    return
  }

  await withTaskLock(
    {
      key: SEARCH_RECONCILE_LOCK_KEY,
      ttlSeconds: SEARCH_RECONCILE_LOCK_TTL_SECONDS,
      taskName: 'searchReconcileTask'
    },
    async () => {
      const result = await reconcileSearchIndex()
      console.log(
        `搜索索引对账完成: PG 共 ${result.total} 条，重新同步 ${result.synced} 条，删除 ${result.deleted} 条`
      )
    }
  ).catch((error) => {
    console.error('搜索索引对账失败:', error)
  })
})
