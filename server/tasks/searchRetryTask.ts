import cron from 'node-cron'
import { getMeiliClient } from '~/lib/meilisearch'
import { getKvSetMembers, removeKvSetMembers } from '~/lib/redis'
import { SEARCH_RETRY_SET_KEY, syncPatchToSearch } from '~/server/search/sync'
import { withTaskLock } from './withTaskLock'

const SEARCH_RETRY_LOCK_KEY = 'search:retry:lock'
const SEARCH_RETRY_LOCK_TTL_SECONDS = 300

const retryFailedSearchSync = async () => {
  if (!getMeiliClient()) {
    return
  }

  const members = await getKvSetMembers(SEARCH_RETRY_SET_KEY)
  if (members.length === 0) {
    return
  }

  for (const member of members) {
    const patchId = Number(member)
    if (!Number.isInteger(patchId) || patchId <= 0) {
      await removeKvSetMembers(SEARCH_RETRY_SET_KEY, [member])
      continue
    }

    try {
      await syncPatchToSearch(patchId)
      await removeKvSetMembers(SEARCH_RETRY_SET_KEY, [member])
    } catch (error) {
      // 保留在集合中等待下一轮重试
      console.error(`搜索重试同步 patch ${patchId} 仍然失败:`, error)
    }
  }
}

export const searchRetryTask = cron.createTask('*/5 * * * *', async () => {
  await withTaskLock(
    {
      key: SEARCH_RETRY_LOCK_KEY,
      ttlSeconds: SEARCH_RETRY_LOCK_TTL_SECONDS,
      taskName: 'searchRetryTask'
    },
    retryFailedSearchSync
  ).catch((error) => {
    console.error('搜索重试队列消费失败:', error)
  })
})
