import 'dotenv/config'
import { getMeiliClient } from '~/lib/meilisearch'
import { GALGAME_INDEX, GALGAME_INDEX_SETTINGS } from '~/server/search/settings'

const initSearchIndex = async () => {
  const client = getMeiliClient()
  if (!client) {
    throw new Error('未配置 MEILISEARCH_HOST / MEILISEARCH_ADMIN_API_KEY')
  }

  const createTask = await client
    .createIndex(GALGAME_INDEX, { primaryKey: 'id' })
    .waitTask()
  if (
    createTask.status !== 'succeeded' &&
    createTask.error?.code !== 'index_already_exists'
  ) {
    throw new Error(`创建索引失败: ${JSON.stringify(createTask.error)}`)
  }
  console.log(`索引 ${GALGAME_INDEX} 就绪`)

  const settingsTask = await client
    .index(GALGAME_INDEX)
    .updateSettings(GALGAME_INDEX_SETTINGS)
    .waitTask({ timeout: 600000 })
  if (settingsTask.status !== 'succeeded') {
    throw new Error(`下发 settings 失败: ${JSON.stringify(settingsTask.error)}`)
  }
  console.log('索引 settings 已下发')
}

initSearchIndex()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
