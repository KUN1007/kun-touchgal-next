import { getNSFWHeader } from './getNSFWHeader'
import { getBlockedTagIds } from './getBlockedTagIds'
import { buildBlockedTagWhere } from '~/utils/blockedTag'
import type { NextRequest } from 'next/server'
import type { Prisma } from '~/prisma/generated/prisma/client'
import type { AuthLoader } from '~/middleware/_verifyHeaderCookie'

export interface PatchVisibilityContext {
  visibilityWhere: Prisma.patchWhereInput
  // 'sfw' | 'nsfw'；null 表示允许全部内容
  contentLimit: string | null
  blockedTagIds: number[]
}

// 与 getPatchVisibilityWhere 同源：Meilisearch 过滤需要原始值，
// Prisma 降级路径需要现成的 where，一次解析同时提供两者
export const getPatchVisibilityContext = async (
  req: NextRequest,
  loadAuth?: AuthLoader
): Promise<PatchVisibilityContext> => {
  let blockedTagIds: number[]
  let nsfwWhere: Awaited<ReturnType<typeof getNSFWHeader>>

  if (loadAuth) {
    const [ids, auth] = await Promise.all([
      getBlockedTagIds(req, loadAuth),
      loadAuth()
    ])
    blockedTagIds = ids
    nsfwWhere = await getNSFWHeader(req, auth?.payload ?? null)
  } else {
    ;[blockedTagIds, nsfwWhere] = await Promise.all([
      getBlockedTagIds(req),
      getNSFWHeader(req)
    ])
  }

  return {
    visibilityWhere: {
      ...nsfwWhere,
      ...buildBlockedTagWhere(blockedTagIds)
    },
    contentLimit: nsfwWhere.content_limit ?? null,
    blockedTagIds
  }
}
