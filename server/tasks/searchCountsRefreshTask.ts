import cron from 'node-cron'
import { prisma } from '~/prisma'
import { getMeiliClient } from '~/lib/meilisearch'
import { getKvHashAll, setKvHashFields } from '~/lib/redis'
import { GALGAME_INDEX } from '~/server/search/settings'
import type { GalgameSearchCountsDoc } from '~/server/search/document'
import { withTaskLock } from './withTaskLock'

const COUNTS_REFRESH_BATCH_SIZE = 2000
const COUNTS_REFRESH_LOCK_KEY = 'search:counts-refresh:lock'
const COUNTS_REFRESH_LOCK_TTL_SECONDS = 1500
const COUNTS_SNAPSHOT_KEY = 'search:counts:fp'

// 指纹覆盖全部会刷入 Meili 的数值字段：任一变化都会触发该行重推
export const countsFingerprint = (doc: GalgameSearchCountsDoc) =>
  `${doc.view}|${doc.download}|${doc.favoriteCount}|${doc.resourceCount}|${doc.commentCount}|${doc.ratingCount}|${doc.avgRating}`

// view/download 等计数只影响排序，变化不触发实时同步；本任务分批读全表，
// 仅将指纹相较 Redis 快照发生变化的行以 partial update（PUT）刷入 Meili，
// 未变的长尾静态行不重推，消除对 Meili 的周期性写放大。
// 快照纯为优化：Meili 写成功后才更新，故快照丢失只会导致一次全量重推、绝不漏推。
// 已删除 patch 会在快照里残留死字段：不被任何现存行的 diff 命中、无正确性影响，
// 仅极缓慢占用内存（每条数十字节）；确需回收时整键删除 COUNTS_SNAPSHOT_KEY 即可。
export const refreshSearchCounts = async () => {
  const client = getMeiliClient()
  if (!client) {
    return
  }
  const index = client.index(GALGAME_INDEX)

  const snapshot = await getKvHashAll(COUNTS_SNAPSHOT_KEY)

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

    const changedDocs: GalgameSearchCountsDoc[] = []
    const changedFingerprints: Record<string, string> = {}
    for (const row of rows) {
      const doc: GalgameSearchCountsDoc = {
        id: row.id,
        view: row.view,
        download: row.download,
        favoriteCount: row.favorite_count,
        resourceCount: row.resource_count,
        commentCount: row.comment_count,
        ratingCount: row.rating_stat?.count ?? 0,
        avgRating: row.rating_stat?.avg_overall ?? 0
      }
      const idKey = String(row.id)
      const fingerprint = countsFingerprint(doc)
      if (snapshot[idKey] !== fingerprint) {
        changedDocs.push(doc)
        changedFingerprints[idKey] = fingerprint
      }
    }

    lastId = rows[rows.length - 1].id

    if (changedDocs.length === 0) {
      continue
    }

    const task = await index
      .updateDocuments(changedDocs)
      .waitTask({ timeout: 600000 })
    if (task.status !== 'succeeded') {
      throw new Error(`计数快照批次写入失败: ${JSON.stringify(task.error)}`)
    }

    await setKvHashFields(COUNTS_SNAPSHOT_KEY, changedFingerprints)
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
