import type { Settings } from 'meilisearch'

export const GALGAME_INDEX = 'galgame'

export const GALGAME_INDEX_SETTINGS: Settings = {
  // 顺序即字段权重：标题 > 别名 > 标签 > 会社 > 外部 ID > 介绍
  searchableAttributes: [
    'name',
    'alias',
    'tag',
    'company',
    'vndbId',
    'vndbRelationId',
    'dlsiteCode',
    'introduction'
  ],

  filterableAttributes: [
    'type',
    'language',
    'platform',
    'contentLimit',
    'tagIds',
    'companyIds',
    'releasedYear',
    'releasedMonth',
    'ratingCount'
  ],

  sortableAttributes: [
    'created',
    'resourceUpdateTime',
    'view',
    'download',
    'favoriteCount',
    'avgRating',
    // 仅作排序并列时的稳定 tiebreaker
    'id'
  ],

  rankingRules: [
    'words',
    'typo',
    'proximity',
    'attribute',
    'sort',
    'exactness'
  ],

  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 }
  },

  // 站内俗称/缩写词库，上线后按零结果搜索词持续补充
  synonyms: {},

  // 精确总数与深分页上限，须大于全库 patch 条数并随增长调整
  pagination: { maxTotalHits: 20000 },

  // 明示语言，避免中/日短查询误判分词管线
  localizedAttributes: [
    {
      attributePatterns: ['name', 'alias', 'introduction'],
      locales: ['cmn', 'jpn', 'eng']
    }
  ]
}
