import { Tag } from './tag'

export interface Patch {
  id: number
  uniqueId: string
  vndbId: string | null
  name: string
  banner: string
  introduction: string
  status: number
  view: number
  download: number
  alias: string[]
  type: string[]
  language: string[]
  platform: string[]
  tags: string[]
  isFavorite: boolean
  contentLimit: string
  ratingSummary: PatchRatingSummary
  user: {
    id: number
    name: string
    avatar: string
  }
  created: string
  updated: string
  _count: {
    favorite_folder: number
    resource: number
    comment: number
  }
}

export interface PatchRatingSummary {
  average: number
  count: number
  histogram: { score: number; count: number }[]
  recommend: {
    strong_no: number
    no: number
    neutral: number
    yes: number
    strong_yes: number
  }
}

export interface PatchIntroduction {
  vndbId: string | null
  introduction: string
  released: string
  alias: string[]
  tag: Tag[]
  resourceUpdateTime: Date | string
  created: Date | string
  updated: Date | string
}

export interface PatchUpdate {
  name: string
  alias: string[]
  introduction: string
}

export interface PatchResource {
  id: number
  name: string
  section: string
  uniqueId: string
  storage: string
  size: string
  type: string[]
  language: string[]
  note: string
  hash: string
  content: string
  code: string
  password: string
  platform: string[]
  likeCount: number
  isLike: boolean
  status: number
  userId: number
  patchId: number
  created: string
  user: KunUser & {
    patchCount: number
    role: number
  }
}

export interface PatchComment {
  id: number
  uniqueId: string
  content: string
  isLike: boolean
  likeCount: number
  parentId: number | null
  userId: number
  patchId: number
  created: string
  updated: string
  reply: PatchComment[]
  user: KunUser
  quotedContent?: string | null
  quotedUsername?: string | null
}
