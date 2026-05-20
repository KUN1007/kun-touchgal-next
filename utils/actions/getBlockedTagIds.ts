'use server'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { parseBlockedTagIds } from '~/utils/blockedTag'
import { verifyKunTokenWithUser } from '~/app/api/utils/jwt'

export const getBlockedTagIds = cache(async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get('kun-galgame-patch-moe-token')?.value
  if (!token) {
    return []
  }

  const cachedBlockedTagIds = cookieStore.get(
    'kun-patch-setting-store|state|data|kunBlockedTagIds'
  )?.value
  if (cachedBlockedTagIds !== undefined) {
    return parseBlockedTagIds(cachedBlockedTagIds)
  }

  const result = await verifyKunTokenWithUser(token)
  if (!result) {
    return []
  }

  return result.user.blocked_tag_ids
})
