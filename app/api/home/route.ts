import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '~/prisma/index'
import { HomeResource } from '~/types/api/home'
import { GalgameCardSelectField } from '~/constants/api/select'
import { getPatchVisibilityWhere } from '~/app/api/utils/getPatchVisibilityWhere'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { shouldBypassSharedCacheForShadowBan } from '~/app/api/utils/shadowBan'
import { getHomeData } from './service'
export const GET = async (req: NextRequest) => {
  const [visibilityWhere, payload] = await Promise.all([
    getPatchVisibilityWhere(req),
    verifyHeaderCookie(req)
  ])
  const bypassCache = await shouldBypassSharedCacheForShadowBan(payload)

  const response = await getHomeData(visibilityWhere, payload, bypassCache)
  return NextResponse.json(response)
}
