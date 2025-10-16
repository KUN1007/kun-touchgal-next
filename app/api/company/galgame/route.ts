import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '~/prisma'
import { getPatchByCompanySchema } from '~/validations/company'
import { kunParseGetQuery } from '~/app/api/utils/parseQuery'
import { GalgameCardSelectField } from '~/constants/api/select'
import { getNSFWHeader } from '~/app/api/utils/getNSFWHeader'

export const getPatchByCompany = async (
  input: z.infer<typeof getPatchByCompanySchema>,
  nsfwEnable: Record<string, string | undefined>
) => {
  const { companyId, page, limit } = input
  const offset = (page - 1) * limit

  const [data, total] = await Promise.all([
    prisma.patch_company_relation.findMany({
      where: { company_id: companyId, patch: nsfwEnable },
      select: {
        patch: {
          select: GalgameCardSelectField
        }
      },
      orderBy: { created: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.patch_company_relation.count({
      where: { company_id: companyId, patch: nsfwEnable }
    })
  ])

  const galgames: GalgameCard[] = data.map((gal) => ({
    ...gal.patch,
    tags: gal.patch.tag.map((t) => t.tag.name).slice(0, 3),
    uniqueId: gal.patch.unique_id,
    averageRating: gal.patch.rating_stat?.avg_overall
      ? Math.round(gal.patch.rating_stat.avg_overall * 10) / 10
      : 0
  }))

  return { galgames, total }
}

export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, getPatchByCompanySchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const nsfwEnable = getNSFWHeader(req)

  const response = await getPatchByCompany(input, nsfwEnable)
  return NextResponse.json(response)
}
