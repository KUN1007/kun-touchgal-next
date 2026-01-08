'use server'

import { z } from 'zod'
import { safeParseSchema } from '~/utils/actions/safeParseSchema'
import { rankingSchema } from '~/validations/ranking'
import { getRanking } from '~/app/api/ranking/route'
import { getNSFWHeader } from '~/utils/actions/getNSFWHeader'

export const kunGetRankingActions = async (
  params: z.infer<typeof rankingSchema>
) => {
  const input = safeParseSchema(rankingSchema, params)
  if (typeof input === 'string') {
    return input
  }

  const nsfwEnable = await getNSFWHeader()
  const response = await getRanking(input, nsfwEnable)
  return response
}
