import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '~/prisma'
import { searchCompanySchema } from '~/validations/company'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'

export const searchCompany = async (
  input: z.infer<typeof searchCompanySchema>
) => {
  const { query } = input

  const companies = await prisma.patch_company.findMany({
    where: {
      OR: query.map((q) => ({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { alias: { has: q } },
          { parent_brand: { has: q } }
        ]
      }))
    },
    select: {
      id: true,
      name: true,
      count: true,
      alias: true
    },
    orderBy: { count: 'desc' },
    take: 100
  })

  return companies.flat()
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, searchCompanySchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const response = await searchCompany(input)
  return NextResponse.json(response)
}
