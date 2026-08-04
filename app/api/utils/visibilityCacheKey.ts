import type { Prisma } from '~/prisma/generated/prisma/client'

type BlockedTagNotShape = {
  tag?: {
    some?: {
      tag_id?: {
        in?: number[]
      }
    }
  }
}

const extractBlockedTagIds = (
  visibilityWhere: Prisma.patchWhereInput
): number[] => {
  const not = visibilityWhere.NOT as
    BlockedTagNotShape | BlockedTagNotShape[] | null | undefined
  if (!not || Array.isArray(not)) {
    return []
  }
  const ids = not.tag?.some?.tag_id?.in
  return Array.isArray(ids) ? [...ids].sort((a, b) => a - b) : []
}

// 屏蔽标签取自未验签的镜像 cookie, 键空间因而由客户端输入决定:
// MAX_BLOCKED_TAG_IDS 只压得住单个键的体积, 压不住键的数量。
// 超过此数量的视角不参与共享缓存, 只回源查询。50 覆盖现网 99.6% 的用户 (<= 31)
export const SHARED_CACHE_MAX_BLOCKED_TAG_IDS = 50

export const exceedsSharedCacheBlockedTagLimit = (
  visibilityWhere: Prisma.patchWhereInput
): boolean =>
  extractBlockedTagIds(visibilityWhere).length >
  SHARED_CACHE_MAX_BLOCKED_TAG_IDS

export const buildVisibilityCacheKey = (
  visibilityWhere: Prisma.patchWhereInput
): string => {
  const limit =
    typeof visibilityWhere.content_limit === 'string'
      ? visibilityWhere.content_limit
      : 'all'
  const blockedTagIds = extractBlockedTagIds(visibilityWhere)
  return `${limit}:${blockedTagIds.join(',')}`
}
