export interface GalgameCard {
  id: number
  uniqueId: string
  name: string
  banner: string
  view: number
  download: number
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

export interface KunPatchRating {
  id: number
  uniqueId: string
  recommend: string
  overall: number
  playStatus: string
  shortSummary: string
  spoilerLevel: string
  isLike: boolean
  likeCount: number
  userId: number
  patchId: number
  created: Date | string
  updated: Date | string
  user: KunUser
}

export interface KunPatchRatingInput {
  patchId: number
  recommend: string
  overall: number
  playStatus: string
  shortSummary: string
  spoilerLevel: string
}

export interface KunPatchRatingUpdateInput extends KunPatchRatingInput {
  ratingId: number
}
