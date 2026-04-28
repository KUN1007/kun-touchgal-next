import type { PatchResource } from '~/types/api/patch'
import type { PatchComment } from '~/types/api/comment'
import type { Message } from '~/types/api/message'

export type AdminStatsName =
  | 'user'
  | 'active'
  | 'patch'
  | 'patch_resource'
  | 'patch_comment'

export interface SumData {
  userCount: number
  galgameCount: number
  galgameResourceCount: number
  galgamePatchResourceCount: number
  galgameCommentCount: number
}

export interface OverviewData {
  newUser: number
  newActiveUser: number
  newGalgame: number
  newGalgameResource: number
  newComment: number
}

export interface AdminUser {
  id: number
  name: string
  email: string
  enable2FA: boolean
  bio: string
  avatar: string
  role: number
  status: number
  dailyImageCount: number
  created: Date | string
  _count: {
    patch: number
    patch_resource: number
  }
}

export interface AdminCreator {
  id: number
  content: string
  status: number
  sender: KunUser | null
  patchResourceCount: number
  created: Date | string
}

export interface AdminGalgame {
  id: number
  uniqueId: string
  name: string
  banner: string
  user: KunUser
  created: Date | string
}

export interface AdminResource extends PatchResource {
  patchName: string
}

export type AdminComment = PatchComment

export interface AdminRating {
  id: number
  uniqueId: string
  user: KunUser
  recommend: string
  overall: number
  playStatus: string
  shortSummary: string
  spoilerLevel: string
  patchName: string
  patchId: number
  like: number
  created: Date | string
}

export type AdminFeedback = Message

export type AdminReportTargetType = 'comment' | 'rating'

export interface AdminReportPatchSummary {
  id: number
  uniqueId: string
  name: string
}

export interface AdminReportCommentSummary {
  id: number
  content: string
}

export interface AdminReportRatingSummary {
  id: number
  shortSummary: string
  overall: number
  recommend: string
  playStatus: string
}

export interface AdminReport {
  id: number
  targetType: AdminReportTargetType
  status: number
  reason: string
  handlerReply: string
  handledAt: Date | string | null
  created: Date | string
  sender: KunUser
  reportedUser: KunUser | null
  handler: KunUser | null
  patch: AdminReportPatchSummary
  comment: AdminReportCommentSummary | null
  rating: AdminReportRatingSummary | null
}

export interface AdminLog {
  id: number
  type: string
  user: KunUser
  content: string
  created: Date | string
}

export interface AdminRedirectConfig {
  enableRedirect: boolean
  excludedDomains: string[]
  delaySeconds: number
}
