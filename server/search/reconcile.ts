import { prisma } from '~/prisma/index'
import { getMeiliClient } from '~/lib/meilisearch'
import { GALGAME_INDEX } from './settings'
import {
  PATCH_SEARCH_SELECT,
  patchToSearchDoc,
  type GalgameSearchDoc
} from './document'

const RECONCILE_BATCH_SIZE = 1000
// markdown 转换是同步 CPU: 每构建这么多文档就让出一次事件循环, 把突发摊平成协作
// 切片, 避免饿死同 cron 进程的 moderation / retry 等定时任务
const DOC_BUILD_CHUNK_SIZE = 50

export interface SearchReconcileResult {
  total: number
  synced: number
  deleted: number
}

// 以 PG 为准比对索引：缺失或 updated 落后的重新同步，索引中多出的删除
export const reconcileSearchIndex =
  async (): Promise<SearchReconcileResult> => {
    const client = getMeiliClient()
    if (!client) {
      throw new Error('未配置 MEILISEARCH_HOST / MEILISEARCH_ADMIN_API_KEY')
    }
    const index = client.index(GALGAME_INDEX)

    // 必须先扫索引、后扫 PG：反过来时，两次扫描之间新建并被出箱排空（与本任务
    // 不共锁）写入索引的 patch 不在 PG 快照中，会被当作索引多余文档误删，且索引
    // 删除不触碰 patch.updated，只能等下一轮对账才恢复。先扫索引则该 patch 不在
    // 索引快照（不进 idsToDelete）、在 PG 快照（走幂等的 idsToSync），严格安全
    const indexUpdatedById = new Map<number, number>()
    for (let offset = 0; ; offset += RECONCILE_BATCH_SIZE) {
      const page = await index.getDocuments<{ id: number; updated: number }>({
        fields: ['id', 'updated'],
        limit: RECONCILE_BATCH_SIZE,
        offset
      })
      for (const doc of page.results) {
        indexUpdatedById.set(doc.id, doc.updated ?? 0)
      }
      if (
        page.results.length === 0 ||
        offset + page.results.length >= page.total
      ) {
        break
      }
    }

    const pgUpdatedById = new Map<number, number>()
    let lastId = 0
    for (;;) {
      const pgRows = await prisma.patch.findMany({
        where: { id: { gt: lastId } },
        orderBy: { id: 'asc' },
        take: RECONCILE_BATCH_SIZE,
        select: { id: true, updated: true }
      })
      if (pgRows.length === 0) {
        break
      }
      for (const row of pgRows) {
        pgUpdatedById.set(row.id, Math.floor(row.updated.getTime() / 1000))
      }
      lastId = pgRows[pgRows.length - 1].id
    }

    const idsToDelete = [...indexUpdatedById.keys()].filter(
      (id) => !pgUpdatedById.has(id)
    )
    const idsToSync = [...pgUpdatedById.entries()]
      .filter(([id, updated]) => (indexUpdatedById.get(id) ?? -1) < updated)
      .map(([id]) => id)

    if (idsToDelete.length > 0) {
      const task = await index
        .deleteDocuments(idsToDelete)
        .waitTask({ timeout: 600000 })
      if (task.status !== 'succeeded') {
        throw new Error(`对账删除失败: ${JSON.stringify(task.error)}`)
      }
    }

    for (let i = 0; i < idsToSync.length; i += RECONCILE_BATCH_SIZE) {
      const batchIds = idsToSync.slice(i, i + RECONCILE_BATCH_SIZE)
      const rows = await prisma.patch.findMany({
        where: { id: { in: batchIds } },
        select: PATCH_SEARCH_SELECT
      })
      const docs: GalgameSearchDoc[] = []
      for (let j = 0; j < rows.length; j += DOC_BUILD_CHUNK_SIZE) {
        const chunk = rows.slice(j, j + DOC_BUILD_CHUNK_SIZE)
        docs.push(...(await Promise.all(chunk.map(patchToSearchDoc))))
        await new Promise((resolve) => setImmediate(resolve))
      }
      const task = await index.addDocuments(docs).waitTask({ timeout: 600000 })
      if (task.status !== 'succeeded') {
        throw new Error(`对账写入失败: ${JSON.stringify(task.error)}`)
      }
    }

    return {
      total: pgUpdatedById.size,
      synced: idsToSync.length,
      deleted: idsToDelete.length
    }
  }
