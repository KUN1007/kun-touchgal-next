import { prisma } from '~/prisma/index'
import { getMeiliClient } from '~/lib/meilisearch'
import { addKvSetMembers } from '~/lib/redis'
import { GALGAME_INDEX } from './settings'
import { PATCH_SEARCH_SELECT, patchToSearchDoc } from './document'

export const SEARCH_RETRY_SET_KEY = 'search:retry'

// 重新从 DB 读取最新完整数据（含关联），保证与事务结果一致；
// patch 已不存在时转为删除索引文档，因此重试队列可统一走本函数
export const syncPatchToSearch = async (patchId: number) => {
  const client = getMeiliClient()
  if (!client) {
    return
  }

  const patch = await prisma.patch.findUnique({
    where: { id: patchId },
    select: PATCH_SEARCH_SELECT
  })
  if (!patch) {
    await client.index(GALGAME_INDEX).deleteDocument(patchId)
    return
  }

  const doc = await patchToSearchDoc(patch)
  await client.index(GALGAME_INDEX).addDocuments([doc])
}

export const removePatchFromSearch = async (patchId: number) => {
  const client = getMeiliClient()
  if (!client) {
    return
  }
  await client.index(GALGAME_INDEX).deleteDocument(patchId)
}

const queueForRetry = async (patchId: number) => {
  try {
    await addKvSetMembers(SEARCH_RETRY_SET_KEY, [String(patchId)])
  } catch (error) {
    console.error('写入搜索重试队列失败:', error)
  }
}

// 写路径出口在事务成功后调用；同步失败仅入重试队列，绝不阻塞主业务。
// 只要配置了引擎就保持索引新鲜，KUN_MEILISEARCH_ENABLED 仅控制查询路径
export const queueSearchSync = (patchId: number) => {
  if (!getMeiliClient()) {
    return
  }
  void syncPatchToSearch(patchId).catch(async (error) => {
    console.error(`同步 patch ${patchId} 到搜索索引失败，已入重试队列:`, error)
    await queueForRetry(patchId)
  })
}

export const queueSearchRemove = (patchId: number) => {
  if (!getMeiliClient()) {
    return
  }
  void removePatchFromSearch(patchId).catch(async (error) => {
    console.error(`从搜索索引删除 patch ${patchId} 失败，已入重试队列:`, error)
    await queueForRetry(patchId)
  })
}
