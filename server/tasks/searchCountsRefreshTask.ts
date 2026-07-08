import cron from 'node-cron'
import { prisma } from '~/prisma'
import { getMeiliClient } from '~/lib/meilisearch'
import { GALGAME_INDEX } from '~/server/search/settings'
import type { GalgameSearchCountsDoc } from '~/server/search/document'
import { withTaskLock } from './withTaskLock'

const COUNTS_REFRESH_BATCH_SIZE = 2000
const COUNTS_REFRESH_LOCK_KEY = 'search:counts-refresh:lock'
const COUNTS_REFRESH_LOCK_TTL_SECONDS = 1500

// view/download 等计数只影响排序，变化不触发实时同步；
// 全表分批以 partial update（PUT）刷入快照，写路径零放大
const refreshSearchCounts = async () => {
  const client = getMeiliClient()
  if (!client) {
    return
  }
  const index = client.index(GALGAME_INDEX)

  let lastId = 0
  for (;;) {
    const rows = await prisma.patch.findMany({
      where: { id: { gt: lastId } },
      orderBy: { id: 'asc' },
      take: COUNTS_REFRESH_BATCH_SIZE,
      select: {
        id: true,
        view: true,
        download: true,
        favorite_count: true,
        resource_count: true,
        comment_count: true,
        rating_stat: { select: { avg_overall: true, count: true } }
      }
    })
    if (rows.length === 0) {
      break
    }

    const docs: GalgameSearchCountsDoc[] = rows.map((row) => ({
      id: row.id,
      view: row.view,
      download: row.download,
      favoriteCount: row.favorite_count,
      resourceCount: row.resource_count,
      commentCount: row.comment_count,
      ratingCount: row.rating_stat?.count ?? 0,
      avgRating: row.rating_stat?.avg_overall ?? 0
    }))

    const task = await index.updateDocuments(docs).waitTask({ timeout: 600000 })
    if (task.status !== 'succeeded') {
      throw new Error(`计数快照批次写入失败: ${JSON.stringify(task.error)}`)
    }

    lastId = rows[rows.length - 1].id
  }
}

export const searchCountsRefreshTask = cron.createTask(
  '*/30 * * * *',
  async () => {
    await withTaskLock(
      {
        key: COUNTS_REFRESH_LOCK_KEY,
        ttlSeconds: COUNTS_REFRESH_LOCK_TTL_SECONDS,
        taskName: 'searchCountsRefreshTask'
      },
      refreshSearchCounts
    ).catch((error) => {
      console.error('搜索计数快照刷新失败:', error)
    })
  }
)
