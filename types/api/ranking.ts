export const RANKING_SORT_FIELDS = [
  'rating',
  'rating_count',
  'like',
  'favorite',
  'resource',
  'comment',
  'view',
  'download'
] as const

export type RankingSortField = (typeof RANKING_SORT_FIELDS)[number]

export interface RankingCard {
  id: number
  uniqueId: string
  name: string
  banner: string
  view: number
  download: number
  averageRating: number
  ratingCount: number
  positiveRecommendCount: number
  type: string[]
  language: string[]
  platform: string[]
  tags: string[]
  created: Date | string
  _count: {
    favorite_folder: number
    resource: number
    comment: number
  }
}
