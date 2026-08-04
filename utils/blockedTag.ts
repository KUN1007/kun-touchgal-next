import type { Prisma } from '~/prisma/generated/prisma/client'

// 镜像 cookie 未验签且长度不受服务端约束, 上限同时压住 NOT IN 的宽度
// 与缓存键的长度; 512 覆盖现网最大值 (328) 并留余量
export const MAX_BLOCKED_TAG_IDS = 512

export const parseBlockedTagIds = (value?: string | null) => {
  if (!value) {
    return []
  }

  try {
    const data = JSON.parse(value)
    if (!Array.isArray(data)) {
      return []
    }

    return [...new Set(data)]
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
      .slice(0, MAX_BLOCKED_TAG_IDS)
  } catch {
    return []
  }
}

export const appendBlockedTagId = (ids: number[], tagId: number) => {
  if (ids.includes(tagId)) {
    return ids
  }

  return [...ids, tagId]
}

export const removeBlockedTagId = (ids: number[], tagId: number) => {
  return ids.filter((id) => id !== tagId)
}

export const buildBlockedTagWhere = (
  blockedTagIds: number[]
): Prisma.patchWhereInput => {
  if (!blockedTagIds.length) {
    return {}
  }

  return {
    NOT: {
      tag: {
        some: {
          tag_id: {
            in: [...blockedTagIds].sort((a, b) => a - b)
          }
        }
      }
    }
  }
}
