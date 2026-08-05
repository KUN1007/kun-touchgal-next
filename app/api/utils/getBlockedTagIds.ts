import { parseCookies } from '~/utils/cookies'
import { parseBlockedTagIds } from '~/utils/blockedTag'
import { verifyKunToken, verifyKunTokenWithUser } from './jwt'
import type { NextRequest } from 'next/server'
import type { AuthLoader } from '~/middleware/_verifyHeaderCookie'

export const getBlockedTagIds = async (
  req: NextRequest,
  loadAuth?: AuthLoader
) => {
  const cookies = parseCookies(req.headers.get('cookie') ?? '')
  const token = cookies['kun-galgame-patch-moe-token']
  if (!token) {
    return []
  }

  const cachedBlockedTagIds =
    cookies['kun-patch-setting-store|state|data|kunBlockedTagIds']
  if (cachedBlockedTagIds !== undefined) {
    const cached = parseBlockedTagIds(cachedBlockedTagIds)
    if (cached !== null) {
      return cached
    }
  }

  const result = await (loadAuth ? loadAuth() : verifyKunTokenWithUser(token))
  if (!result) {
    return []
  }

  return result.user.blocked_tag_ids
}

export const getAuthenticatedBlockedTagIds = async (req: NextRequest) => {
  const cookies = parseCookies(req.headers.get('cookie') ?? '')
  const token = cookies['kun-galgame-patch-moe-token']
  if (!token) {
    return null
  }

  const cachedBlockedTagIds =
    cookies['kun-patch-setting-store|state|data|kunBlockedTagIds']
  if (cachedBlockedTagIds !== undefined) {
    const cached = parseBlockedTagIds(cachedBlockedTagIds)
    if (cached !== null) {
      const payload = await verifyKunToken(token)
      if (!payload) {
        return null
      }
      return cached
    }
  }

  const result = await verifyKunTokenWithUser(token)
  if (!result) {
    return null
  }

  return result.user.blocked_tag_ids
}
