'use server'

import { z } from 'zod'
import { safeParseSchema } from '~/utils/actions/safeParseSchema'
import { getCompanyById } from '~/app/api/company/route'
import { getPatchByCompany } from '~/app/api/company/galgame/route'
import {
  getCompanyByIdSchema,
  getPatchByCompanySchema
} from '~/validations/company'
import { getNSFWHeader } from '~/utils/actions/getNSFWHeader'

export const kunGetCompanyByIdActions = async (
  params: z.infer<typeof getCompanyByIdSchema>
) => {
  const input = safeParseSchema(getCompanyByIdSchema, params)
  if (typeof input === 'string') {
    return input
  }

  const response = await getCompanyById(input)
  return response
}

export const kunCompanyGalgameActions = async (
  params: z.infer<typeof getPatchByCompanySchema>
) => {
  const input = safeParseSchema(getPatchByCompanySchema, params)
  if (typeof input === 'string') {
    return input
  }

  const nsfwEnable = await getNSFWHeader()

  const response = await getPatchByCompany(input, nsfwEnable)
  return response
}
