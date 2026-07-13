import { prisma } from '~/prisma/index'
import { getMeiliClient } from '~/lib/meilisearch'
import { GALGAME_INDEX } from './settings'
import { PATCH_SEARCH_SELECT, patchToSearchDoc } from './document'

const RECONCILE_BATCH_SIZE = 1000

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
      const docs = await Promise.all(rows.map(patchToSearchDoc))
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
