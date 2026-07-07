import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '~/prisma'
import { getPatchByCompanySchema } from '~/validations/company'
import { kunParseGetQuery } from '~/app/api/utils/parseQuery'
import { GalgameCardSelectField } from '~/constants/api/select'
import { getPatchVisibilityContext } from '~/app/api/utils/getPatchVisibilityContext'
import {
  ALL_SUPPORTED_LANGUAGE,
  ALL_SUPPORTED_PLATFORM,
  ALL_SUPPORTED_TYPE
} from '~/constants/resource'
import {
  buildGalgameDateFilter,
  buildGalgameOrderBy,
  buildGalgameWhere
} from '~/app/api/utils/galgameQuery'
import { parseGalgameFilterArray } from '~/utils/galgameFilter'
import { getPatchByCompany } from './service'
export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, getPatchByCompanySchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  if (
    !ALL_SUPPORTED_TYPE.includes(input.selectedType) ||
    !ALL_SUPPORTED_LANGUAGE.includes(input.selectedLanguage) ||
    !ALL_SUPPORTED_PLATFORM.includes(input.selectedPlatform)
  ) {
    return NextResponse.json('请选择我们支持的 Galgame 排序类型')
  }

  const visibility = await getPatchVisibilityContext(req)

  const response = await getPatchByCompany(input, visibility)
  return NextResponse.json(response)
}
