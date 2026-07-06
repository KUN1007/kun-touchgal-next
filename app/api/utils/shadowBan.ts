import { prisma } from '~/prisma/index'
import { Prisma } from '~/prisma/generated/prisma/client'

export interface KunViewer {
  uid: number
  role: number
}

// Shadow banned content is visible only to its author and role >= 3
export const isShadowBanExemptViewer = (
  viewer: KunViewer | null,
  ownerId: number
) => !!viewer && (viewer.role >= 3 || viewer.uid === ownerId)

// WHERE fragment for patch_comment / patch_rating
// status: 0 normal, 1 shadow banned, 2 hidden (invisible to everyone on the
// frontend, including admins; manageable only in /admin)
export const getShadowBanWhere = (viewer: KunViewer | null) => {
  if (viewer && viewer.role >= 3) {
    return { status: { in: [0, 1] } }
  }
  if (viewer && viewer.uid > 0) {
    return { OR: [{ status: 0 }, { status: 1, user_id: viewer.uid }] }
  }
  return { status: 0 }
}

// WHERE fragment for patch_resource; status=2 (pending approval) and
// status=3 (hidden, /admin only) stay invisible for every viewer
export const getResourceShadowBanWhere = (viewer: KunViewer | null) => {
  if (viewer && viewer.role >= 3) {
    return { status: { in: [0, 1] } }
  }
  if (viewer && viewer.uid > 0) {
    return { OR: [{ status: 0 }, { status: 1, user_id: viewer.uid }] }
  }
  return { status: 0 }
}

// Raw SQL fragment for the recursive CTEs in patch comment fetching
export const getShadowBanSql = (viewer: KunViewer | null) =>
  viewer && viewer.role >= 3
    ? Prisma.sql`status IN (0, 1)`
    : Prisma.sql`(status = 0 OR (status = 1 AND user_id = ${viewer?.uid ?? 0}))`

// Shared (cross-viewer) caches must be skipped for viewers whose response
// differs from the public one: admins, authors of shadow banned resources,
// and avatar shadow banned users (they must keep seeing their real avatar)
export const shouldBypassSharedCacheForShadowBan = async (
  viewer: KunViewer | null
) => {
  if (!viewer) {
    return false
  }
  if (viewer.role >= 3) {
    return true
  }

  const [bannedResourceCount, user] = await Promise.all([
    prisma.patch_resource.count({
      where: { user_id: viewer.uid, status: 1 }
    }),
    prisma.user.findUnique({
      where: { id: viewer.uid },
      select: { avatar_shadow_ban: true }
    })
  ])
  return bannedResourceCount > 0 || !!user?.avatar_shadow_ban
}

// Mask avatar / bio of shadow banned users in embedded user payloads
export const maskShadowBannedUser = <
  T extends {
    id: number
    avatar: string
    bio?: string
    avatar_shadow_ban: boolean
    bio_shadow_ban: boolean
  }
>(
  viewer: KunViewer | null,
  user: T
) => {
  const exempt = isShadowBanExemptViewer(viewer, user.id)
  return {
    avatar: !exempt && user.avatar_shadow_ban ? '' : user.avatar,
    bio: !exempt && user.bio_shadow_ban ? '' : (user.bio ?? '')
  }
}
