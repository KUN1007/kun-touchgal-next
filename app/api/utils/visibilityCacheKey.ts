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
// 任意 1~N 个标签的子集都各自铸一个键, 键数量无界; sha1 只压键名长度,
// 单键 id 数上限只压单键体积, 两者都治不了键的数量。因此只要视角带任何
// 屏蔽标签就不参与共享缓存, 只回源查询——共享缓存键随之坍缩到与客户端输入
// 无关的公开视角 (加少数 NSFW 变体), 无法被铸键攻击撑爆。
export const hasBlockedTagFilter = (
  visibilityWhere: Prisma.patchWhereInput
): boolean => extractBlockedTagIds(visibilityWhere).length > 0

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
