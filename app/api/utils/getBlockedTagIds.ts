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
    // 镜像 cookie 未验签, 采信前必须验证 token 有效, 否则任意非空 token
    // 都能凭客户端输入左右可见性与缓存键 (见 visibilityCacheKey)
    const auth = await (loadAuth ? loadAuth() : verifyKunToken(token))
    if (!auth) {
      return []
    }
    return parseBlockedTagIds(cachedBlockedTagIds)
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
    const payload = await verifyKunToken(token)
    if (!payload) {
      return null
    }
    return parseBlockedTagIds(cachedBlockedTagIds)
  }

  const result = await verifyKunTokenWithUser(token)
  if (!result) {
    return null
  }

  return result.user.blocked_tag_ids
}
