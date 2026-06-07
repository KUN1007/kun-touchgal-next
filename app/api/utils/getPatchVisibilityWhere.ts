import { getNSFWHeader } from './getNSFWHeader'
import { getBlockedTagIds } from './getBlockedTagIds'
import { buildBlockedTagWhere } from '~/utils/blockedTag'
import type { NextRequest } from 'next/server'
import type { Prisma } from '~/prisma/generated/prisma/client'

export const getPatchVisibilityWhere = async (
  req: NextRequest
): Promise<Prisma.patchWhereInput> => {
  const [blockedTagIds, nsfwWhere] = await Promise.all([
    getBlockedTagIds(req),
    getNSFWHeader(req)
  ])

  return {
    ...nsfwWhere,
    ...buildBlockedTagWhere(blockedTagIds)
  }
}
