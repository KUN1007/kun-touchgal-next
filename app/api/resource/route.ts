import { NextRequest, NextResponse } from 'next/server'
import { kunParseGetQuery } from '../utils/parseQuery'
import { resourceSchema } from '~/validations/resource'
import { getPatchVisibilityWhere } from '~/app/api/utils/getPatchVisibilityWhere'
import { createAuthLoader } from '~/middleware/_verifyHeaderCookie'
import { shouldBypassSharedCache } from '~/app/api/utils/contentVisibility'
import { getPatchResource } from './service'

export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, resourceSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const loadAuth = createAuthLoader(req)
  const [visibilityWhere, auth] = await Promise.all([
    getPatchVisibilityWhere(req, loadAuth),
    loadAuth()
  ])
  const payload = auth?.payload ?? null
  const bypassCache = await shouldBypassSharedCache(payload)

  const response = await getPatchResource(
    input,
    visibilityWhere,
    payload,
    bypassCache
  )
  return NextResponse.json(response)
}
