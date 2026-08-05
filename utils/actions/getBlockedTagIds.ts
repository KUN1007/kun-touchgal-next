'use server'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { parseBlockedTagIds } from '~/utils/blockedTag'
import { loadAuthUser } from './loadAuthUser'

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
    // 镜像 cookie 未验签, 采信前必须验证会话有效 (见 API 版同名函数)
    const result = await loadAuthUser()
    if (!result) {
      return []
    }
    return parseBlockedTagIds(cachedBlockedTagIds)
  }

  const result = await loadAuthUser()
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
    const result = await loadAuthUser()
    if (!result) {
      return null
    }

    return {
      payload: result.payload,
      blockedTagIds: parseBlockedTagIds(cachedBlockedTagIds)
    }
  }

  const result = await loadAuthUser()
  if (!result) {
    return null
  }

  return {
    payload: result.payload,
    blockedTagIds: result.user.blocked_tag_ids
  }
})
