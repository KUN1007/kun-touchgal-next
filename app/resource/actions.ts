'use server'

import { z } from 'zod'
import { safeParseSchema } from '~/utils/actions/safeParseSchema'
import { resourceSchema } from '~/validations/resource'
import { getPatchResource } from '~/app/api/resource/service'
import { getPatchVisibilityWhere } from '~/utils/actions/getPatchVisibilityWhere'
import { verifyHeaderCookie } from '~/utils/actions/verifyHeaderCookie'
import { shouldBypassSharedCacheForShadowBan } from '~/app/api/utils/shadowBan'

export const kunGetActions = async (params: z.infer<typeof resourceSchema>) => {
  const input = safeParseSchema(resourceSchema, params)
  if (typeof input === 'string') {
    return input
  }

  const [visibilityWhere, payload] = await Promise.all([
    getPatchVisibilityWhere(),
    verifyHeaderCookie()
  ])
  const bypassCache = await shouldBypassSharedCacheForShadowBan(payload)

  const response = await getPatchResource(
    input,
    visibilityWhere,
    payload,
    bypassCache
  )
  return response
}
