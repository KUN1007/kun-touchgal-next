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
    | BlockedTagNotShape
    | BlockedTagNotShape[]
    | null
    | undefined
  if (!not || Array.isArray(not)) {
    return []
  }
  const ids = not.tag?.some?.tag_id?.in
  return Array.isArray(ids) ? [...ids].sort((a, b) => a - b) : []
}

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
