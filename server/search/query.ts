import { prisma } from '~/prisma/index'
import { getMeiliClient } from '~/lib/meilisearch'
import {
  GalgameCardSelectField,
  toGalgameCardCount
} from '~/constants/api/select'
import { GALGAME_INDEX } from './settings'
import type { Prisma } from '~/prisma/generated/prisma/client'

// 超时即中止请求，由调用方捕获错误后降级到 Prisma 实现
export const SEARCH_QUERY_TIMEOUT_MS = 800

// 相关性下限（_rankingScore 0..1）：仅在有查询词时生效，剔除勉强命中的长尾。
// 上线后按零结果/噪声查询校准，调高更严、调低更全
export const SEARCH_RANKING_SCORE_THRESHOLD = 0.4

export interface GalgameIndexQuery {
  q?: string
  filter?: string
  sort?: string[]
  page: number
  hitsPerPage: number
  attributesToSearchOn?: string[]
}

// 索引只负责"找到哪些 id、按什么顺序"，完整数据回查 PostgreSQL
export const queryGalgameIndex = async (query: GalgameIndexQuery) => {
  const client = getMeiliClient()
  if (!client) {
    throw new Error('Meilisearch client 未配置')
  }

  const res = await client.index<{ id: number }>(GALGAME_INDEX).search(
    query.q ?? '',
    {
      filter: query.filter || undefined,
      sort: query.sort && query.sort.length > 0 ? query.sort : undefined,
      page: query.page,
      hitsPerPage: query.hitsPerPage,
      attributesToSearchOn: query.attributesToSearchOn,
      // 与旧实现的多关键词 AND 语义对齐
      matchingStrategy: 'all',
      // 纯筛选/浏览端点 q 为空、所有文档得分 1.0，不受影响；仅约束有文字搜索的场景
      rankingScoreThreshold: query.q ? SEARCH_RANKING_SCORE_THRESHOLD : undefined,
      attributesToRetrieve: ['id']
    },
    { signal: AbortSignal.timeout(SEARCH_QUERY_TIMEOUT_MS) }
  )

  return {
    ids: res.hits.map((hit) => hit.id),
    total: res.totalHits
  }
}

type GalgameCardPayload = Prisma.patchGetPayload<{
  select: typeof GalgameCardSelectField
}>

const toGalgameCard = (gal: GalgameCardPayload): GalgameCard => ({
  id: gal.id,
  uniqueId: gal.unique_id,
  name: gal.name,
  banner: gal.banner,
  view: gal.view,
  download: gal.download,
  type: gal.type,
  language: gal.language,
  platform: gal.platform,
  tags: gal.tag.map((t) => t.tag.name).slice(0, 3),
  created: gal.created,
  _count: toGalgameCardCount(gal),
  averageRating: gal.rating_stat?.avg_overall
    ? Math.round(gal.rating_stat.avg_overall * 10) / 10
    : 0
})

// 主键回查并按命中顺序重排，返回与旧实现一致的卡片结构。
// 索引可能短暂滞后于 PG（异步同步/重试窗口），回查必须重新应用可见性过滤，
// 防止分级（content_limit）已变更的条目经过期索引泄露给受限用户
export const fetchGalgameCardsByIds = async (
  ids: number[],
  visibilityWhere: Prisma.patchWhereInput
): Promise<GalgameCard[]> => {
  if (ids.length === 0) {
    return []
  }

  const rows = await prisma.patch.findMany({
    where: { id: { in: ids }, ...visibilityWhere },
    select: GalgameCardSelectField
  })
  const rowById = new Map(rows.map((row) => [row.id, row]))

  return ids
    .map((id) => rowById.get(id))
    .filter((row): row is GalgameCardPayload => !!row)
    .map(toGalgameCard)
}
