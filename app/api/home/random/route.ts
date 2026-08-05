import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '~/prisma/index'
import { getPatchVisibilityWhere } from '~/app/api/utils/getPatchVisibilityWhere'
import { createAuthLoader } from '~/middleware/_verifyHeaderCookie'
import type { Prisma } from '~/prisma/generated/prisma/client'

const getRandomUniqueId = async (visibilityWhere: Prisma.patchWhereInput) => {
  const count = await prisma.patch.count({ where: visibilityWhere })
  if (count === 0) {
    return '未查询到文章'
  }

  const [randomPatch] = await prisma.patch.findMany({
    where: visibilityWhere,
    orderBy: { id: 'asc' },
    skip: Math.floor(Math.random() * count),
    take: 1,
    select: { unique_id: true }
  })
  const patch =
    randomPatch ??
    (await prisma.patch.findFirst({
      where: visibilityWhere,
      orderBy: { id: 'asc' },
      select: { unique_id: true }
    }))

  return patch ? { uniqueId: patch.unique_id } : '未查询到文章'
}

export const GET = async (req: NextRequest) => {
  const loadAuth = createAuthLoader(req)
  const visibilityWhere = await getPatchVisibilityWhere(req, loadAuth)

  const response = await getRandomUniqueId(visibilityWhere)
  return NextResponse.json(response)
}
