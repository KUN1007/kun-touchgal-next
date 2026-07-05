import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParseGetQuery } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { getUserInfoSchema } from '~/validations/user'
import { getPatchVisibilityWhere } from '~/app/api/utils/getPatchVisibilityWhere'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import type { UserResource } from '~/types/api/user'
import { getUserPatchResource } from './service'
export async function GET(req: NextRequest) {
  const input = kunParseGetQuery(req, getUserInfoSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户登陆失效')
  }
  const visibilityWhere = await getPatchVisibilityWhere(req)

  const response = await getUserPatchResource(input, visibilityWhere, payload)
  return NextResponse.json(response)
}
