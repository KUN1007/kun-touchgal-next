import { getNSFWHeader } from './getNSFWHeader'
import { getBlockedTagIds } from './getBlockedTagIds'
import { buildBlockedTagWhere } from '~/utils/blockedTag'
import type { NextRequest } from 'next/server'
import type { Prisma } from '~/prisma/generated/prisma/client'
import type { AuthLoader } from '~/middleware/_verifyHeaderCookie'

export const getPatchVisibilityWhere = async (
  req: NextRequest,
  loadAuth?: AuthLoader
): Promise<Prisma.patchWhereInput> => {
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
    ...nsfwWhere,
    ...buildBlockedTagWhere(blockedTagIds)
  }
}
