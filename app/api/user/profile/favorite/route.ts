import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParseGetQuery } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { getUserInfoSchema } from '~/validations/user'
import { GalgameCardSelectField } from '~/constants/api/select'
import { getNSFWHeader } from '~/app/api/utils/getNSFWHeader'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'

const getUserFavorite = async (
  input: z.infer<typeof getUserInfoSchema>,
  nsfwEnable: Record<string, string | undefined>
) => {
  const { uid, page, limit } = input
  const offset = (page - 1) * limit

  // const [data, total] = await Promise.all([
  //   prisma.user_patch_favorite_relation.findMany({
  //     where: { user_id: uid, patch: nsfwEnable },
  //     include: {
  //       patch: {
  //         select: GalgameCardSelectField
  //       }
  //     },
  //     orderBy: { created: 'desc' },
  //     take: limit,
  //     skip: offset
  //   }),
  //   prisma.user_patch_favorite_relation.count({
  //     where: { user_id: uid, patch: nsfwEnable }
  //   })
  // ])

  // const favorites: GalgameCard[] = data.map((gal) => ({
  //   ...gal.patch,
  //   tags: gal.patch.tag.map((t) => t.tag.name).slice(0, 3),
  //   uniqueId: gal.patch.unique_id
  // }))

  return { favorites: [], total: 0 }
}

export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, getUserInfoSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户登陆失效')
  }
  const nsfwEnable = await getNSFWHeader(req, payload)

  const response = await getUserFavorite(input, nsfwEnable)
  return NextResponse.json(response)
}
