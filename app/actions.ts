'use server'

import { getPatchVisibilityWhere } from '~/utils/actions/getPatchVisibilityWhere'
import { verifyHeaderCookie } from '~/utils/actions/verifyHeaderCookie'
import { shouldBypassSharedCacheForShadowBan } from '~/app/api/utils/shadowBan'
import { getHomeData } from '~/app/api/home/service'

export const kunGetActions = async () => {
  const [visibilityWhere, payload] = await Promise.all([
    getPatchVisibilityWhere(),
    verifyHeaderCookie()
  ])
  const bypassCache = await shouldBypassSharedCacheForShadowBan(payload)
  const response = await getHomeData(visibilityWhere, payload, bypassCache)
  return response
}
