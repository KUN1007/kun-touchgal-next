'use server'

import { z } from 'zod'
import { safeParseSchema } from '~/utils/actions/safeParseSchema'
import { adminPaginationSchema } from '~/validations/admin'
import { getPatchResourceApply } from '~/app/api/admin/resource-apply/get'
import { getNSFWHeader } from '~/utils/actions/getNSFWHeader'
import { verifyHeaderCookie } from '~/utils/actions/verifyHeaderCookie'

export const kunGetActions = async (
  params: z.infer<typeof adminPaginationSchema>
) => {
  const input = safeParseSchema(adminPaginationSchema, params)
  if (typeof input === 'string') {
    return input
  }
  const payload = await verifyHeaderCookie()
  if (!payload) {
    return '未登录'
  }
  if (payload.role < 3) {
    return '权限不足'
  }

  const nsfwEnable = await getNSFWHeader()

  const response = await getPatchResourceApply(input, nsfwEnable)
  return response
}

