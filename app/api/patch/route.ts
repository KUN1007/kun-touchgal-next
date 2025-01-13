import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import {
  kunParseDeleteQuery,
  kunParseGetQuery
} from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { getPatchById } from './get'
import { deletePatchById } from './delete'
import { getKv, setKv } from '~/lib/redis'
import { PATCH_CACHE_DURATION } from '~/config/cache'

const CACHE_KEY = 'patch'

const uniqueIdSchema = z.object({
  uniqueId: z.string().min(8).max(8)
})

const patchIdSchema = z.object({
  patchId: z.coerce.number().min(1).max(9999999)
})

export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, uniqueIdSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const cachedPatch = await getKv(`${CACHE_KEY}:${input.uniqueId}`)
  if (cachedPatch) {
    return NextResponse.json(JSON.parse(cachedPatch))
  }

  const payload = await verifyHeaderCookie(req)

  const response = await getPatchById(input, payload?.uid ?? 0)
  await setKv(
    `${CACHE_KEY}:${input.uniqueId}`,
    JSON.stringify(response),
    PATCH_CACHE_DURATION
  )

  return NextResponse.json(response)
}

export const DELETE = async (req: NextRequest) => {
  const input = kunParseDeleteQuery(req, patchIdSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }
  if (payload.role < 3) {
    return NextResponse.json('本页面仅管理员可访问')
  }

  const response = await deletePatchById(input)
  return NextResponse.json(response)
}
