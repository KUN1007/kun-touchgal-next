import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParseGetQuery } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { duplicateSchema } from '~/validations/edit'
import type { Prisma } from '~/prisma/generated/prisma/client'

export const duplicate = async (input: z.infer<typeof duplicateSchema>) => {
  const vndbId = input.vndbId?.toLowerCase()
  const vndbRelationId = input.vndbRelationId?.toLowerCase()
  const dlsiteCode = input.dlsiteCode?.toUpperCase()
  const title = input.title

  const conditions: Prisma.patchWhereInput[] = []

  if (vndbId && vndbRelationId) {
    conditions.push({
      AND: [{ vndb_id: vndbId }, { vndb_relation_id: vndbRelationId }]
    })
  }

  if (vndbId) {
    conditions.push({ vndb_id: vndbId })
  }

  if (vndbRelationId) {
    conditions.push({ vndb_relation_id: vndbRelationId })
  }

  if (dlsiteCode) {
    conditions.push({ dlsite_code: dlsiteCode })
  }

  if (title) {
    conditions.push({
      name: {
        equals: title,
        mode: 'insensitive'
      }
    })
    conditions.push({
      alias: {
        some: {
          name: {
            equals: title,
            mode: 'insensitive'
          }
        }
      }
    })
  }

  if (!conditions.length) {
    return {}
  }

  const patch = await prisma.patch.findFirst({
    where: {
      OR: conditions
    },
    select: {
      unique_id: true
    }
  })

  if (patch?.unique_id) {
    return { uniqueId: patch.unique_id }
  }

  return {}
}

export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, duplicateSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const response = await duplicate(input)
  return NextResponse.json(response)
}
