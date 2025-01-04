import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParseGetQuery } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { getUserInfoSchema } from '~/validations/user'
import { GalgameCardSelectField } from '~/constants/api/select'

export const getUserFavorite = async (
  input: z.infer<typeof getUserInfoSchema>
) => {
  const { uid, page, limit } = input
  const offset = (page - 1) * limit

  const [data, total] = await Promise.all([
    await prisma.user_patch_favorite_relation.findMany({
      where: { user_id: uid },
      include: {
        patch: {
          select: GalgameCardSelectField
        }
      },
      orderBy: { created: 'desc' },
      take: limit,
      skip: offset
    }),
    await prisma.user_patch_favorite_relation.count({
      where: { user_id: uid }
    })
  ])

  const favorites: GalgameCard[] = data.map((gal) => ({
    ...gal.patch,
    uniqueId: gal.patch.unique_id
  }))

  return { favorites, total }
}

export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, getUserInfoSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const response = await getUserFavorite(input)
  return NextResponse.json(response)
}
