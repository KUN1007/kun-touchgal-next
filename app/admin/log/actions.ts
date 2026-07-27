'use server'

import { z } from 'zod'
import { safeParseSchema } from '~/utils/actions/safeParseSchema'
import { adminPaginationSchema } from '~/validations/admin'
import { getLog } from '~/app/api/admin/log/service'
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
    return '用户登录失效'
  }
  if (payload.role < 4) {
    return '本页面仅超级管理员可访问'
  }

  const response = await getLog(input)
  return response
}
