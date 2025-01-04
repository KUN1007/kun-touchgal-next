import type { PatchResource } from '~/types/api/patch'
import type { PatchComment } from '~/types/api/comment'

export interface AdminStats {
  title: string
  value: string
  change: number
}

export interface AdminUser {
  id: number
  name: string
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

export interface AdminLog {
  id: number
  type: string
  user: KunUser
  content: string
  created: Date | string
}
