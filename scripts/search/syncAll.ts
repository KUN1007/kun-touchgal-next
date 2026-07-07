import 'dotenv/config'
import { prisma } from '~/prisma/index'
import { getMeiliClient } from '~/lib/meilisearch'
import { GALGAME_INDEX, GALGAME_INDEX_SETTINGS } from '~/server/search/settings'
import { PATCH_SEARCH_SELECT, patchToSearchDoc } from '~/server/search/document'

const BATCH_SIZE = 1000

const syncAllPatchesToSearch = async () => {
  const client = getMeiliClient()
  if (!client) {
    throw new Error('未配置 MEILISEARCH_HOST / MEILISEARCH_ADMIN_API_KEY')
  }
  const index = client.index(GALGAME_INDEX)

  const total = await prisma.patch.count()
  console.log(`待同步 patch 共 ${total} 条`)

  const maxTotalHits = GALGAME_INDEX_SETTINGS.pagination?.maxTotalHits ?? 0
  if (maxTotalHits > 0 && total > maxTotalHits) {
    console.warn(
      `警告: patch 总数 ${total} 超过 settings.pagination.maxTotalHits (${maxTotalHits})，` +
        '总数与深分页将被截断，请调大该值后重新执行 search:init'
    )
  }

  let processed = 0
  let lastId = 0
  for (;;) {
    const rows = await prisma.patch.findMany({
      where: { id: { gt: lastId } },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      select: PATCH_SEARCH_SELECT
    })
    if (rows.length === 0) {
      break
    }

    const docs = await Promise.all(rows.map(patchToSearchDoc))
    const task = await index.addDocuments(docs).waitTask({ timeout: 600000 })
    if (task.status !== 'succeeded') {
      throw new Error(
        `批次写入失败 (lastId=${lastId}): ${JSON.stringify(task.error)}`
      )
    }

    processed += rows.length
    lastId = rows[rows.length - 1].id
    console.log(`已同步 ${processed}/${total}`)
  }

  console.log('全量同步完成')
}

syncAllPatchesToSearch()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
