'use server'

import { z } from 'zod'
import { safeParseSchema } from '~/utils/actions/safeParseSchema'
import { getAppeals } from '~/app/api/admin/appeal/get'
import { adminAppealPaginationSchema } from '~/validations/admin'
import { verifyHeaderCookie } from '~/utils/actions/verifyHeaderCookie'

export const kunGetAppealsActions = async (
  params: z.infer<typeof adminAppealPaginationSchema>
) => {
  const input = safeParseSchema(adminAppealPaginationSchema, params)
  if (typeof input === 'string') {
    return input
  }
  const payload = await verifyHeaderCookie()
  if (!payload) {
    return '用户登陆失效'
  }
  if (payload.role < 4) {
    return '本页面仅超级管理员可访问'
  }

  const response = await getAppeals(input)
  return response
}
