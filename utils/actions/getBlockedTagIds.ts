'use server'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { parseBlockedTagIds } from '~/utils/blockedTag'
import { verifyKunToken, verifyKunTokenWithUser } from '~/app/api/utils/jwt'

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

export const getAuthenticatedBlockedTagIds = cache(async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get('kun-galgame-patch-moe-token')?.value
  if (!token) {
    return null
  }

  const cachedBlockedTagIds = cookieStore.get(
    'kun-patch-setting-store|state|data|kunBlockedTagIds'
  )?.value
  if (cachedBlockedTagIds !== undefined) {
    const payload = await verifyKunToken(token)
    if (!payload) {
      return null
    }

    return {
      payload,
      blockedTagIds: parseBlockedTagIds(cachedBlockedTagIds)
    }
  }

  const result = await verifyKunTokenWithUser(token)
  if (!result) {
    return null
  }

  return {
    payload: result.payload,
    blockedTagIds: result.user.blocked_tag_ids
  }
})
