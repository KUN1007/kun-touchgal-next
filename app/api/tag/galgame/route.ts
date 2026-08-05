import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParseGetQuery } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { getPatchByTagSchema } from '~/validations/tag'
import { GalgameCardSelectField } from '~/constants/api/select'
import { getPatchVisibilityContext } from '~/app/api/utils/getPatchVisibilityContext'
import { createAuthLoader } from '~/middleware/_verifyHeaderCookie'
import {
  buildGalgameDateFilter,
  buildGalgameOrderBy,
  buildGalgameWhere
} from '~/app/api/utils/galgameQuery'
import { parseGalgameFilterArray } from '~/utils/galgameFilter'
import { getPatchByTag } from './service'
export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, getPatchByTagSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const loadAuth = createAuthLoader(req)
  const visibility = await getPatchVisibilityContext(req, loadAuth)

  const response = await getPatchByTag(input, visibility)
  return NextResponse.json(response)
}
