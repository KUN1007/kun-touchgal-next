import { getMeiliClient } from '~/lib/meilisearch'
import { GALGAME_INDEX } from './settings'
import type { GalgameSearchDoc } from './document'

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

// 卡片渲染所需的文档字段白名单：只回取这些，避免把 introduction 等大字段传回。
const GALGAME_CARD_DOC_FIELDS = [
  'id',
  'uniqueId',
  'name',
  'banner',
  'view',
  'download',
  'type',
  'language',
  'platform',
  'tag',
  'created',
  'favoriteCount',
  'resourceCount',
  'commentCount',
  'avgRating'
]

// 索引文档直接映射为卡片：可见性过滤（content_limit / 屏蔽标签）已在 Meilisearch
// filter 内完成，不再回查 PostgreSQL，因此 total 与实际卡片数恒一致。
// created 以 Unix 秒存储，转回 ISO 字符串与旧 Prisma 实现（Date 经 JSON 序列化）一致。
// banner / resourceCount / commentCount 是新增文档字段，重建索引前的旧文档可能缺失，
// 做兜底避免渲染异常；重建索引（pnpm search:sync-all）后取到真实值。
export const searchDocToGalgameCard = (doc: GalgameSearchDoc): GalgameCard => ({
  id: doc.id,
  uniqueId: doc.uniqueId,
  name: doc.name,
  banner: doc.banner ?? '',
  view: doc.view,
  download: doc.download,
  type: doc.type,
  language: doc.language,
  platform: doc.platform,
  tags: doc.tag?.slice(0, 3) ?? [],
  created: new Date(doc.created * 1000).toISOString(),
  _count: {
    favorite_folder: doc.favoriteCount,
    resource: doc.resourceCount ?? 0,
    comment: doc.commentCount ?? 0
  },
  averageRating: doc.avgRating ? Math.round(doc.avgRating * 10) / 10 : 0
})

// 索引负责"找到哪些文档、按什么顺序"，并直接携带卡片渲染所需字段，
// 一次查询同时得到卡片与精确总数，二者同源不再错位。
export const queryGalgameIndex = async (
  query: GalgameIndexQuery
): Promise<{ galgames: GalgameCard[]; total: number }> => {
  const client = getMeiliClient()
  if (!client) {
    throw new Error('Meilisearch client 未配置')
  }

  const res = await client.index<GalgameSearchDoc>(GALGAME_INDEX).search(
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
      attributesToRetrieve: GALGAME_CARD_DOC_FIELDS
    },
    { signal: AbortSignal.timeout(SEARCH_QUERY_TIMEOUT_MS) }
  )

  return {
    galgames: res.hits.map(searchDocToGalgameCard),
    total: res.totalHits
  }
}
