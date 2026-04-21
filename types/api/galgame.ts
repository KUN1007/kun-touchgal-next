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

export interface KunPatchRatingUpdateInput {
  ratingId: number
  recommend: string
  overall: number
  playStatus: string
  shortSummary: string
  spoilerLevel: string
}

export interface KunPatchRatingResponse {
  ratings: KunPatchRating[]
  total: number
}
