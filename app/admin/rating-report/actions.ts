'use server'

import { z } from 'zod'
import { safeParseSchema } from '~/utils/actions/safeParseSchema'
import { adminReportPaginationSchema } from '~/validations/admin'
import { getReport } from '~/app/api/admin/report/service'
import { verifyHeaderCookie } from '~/utils/actions/verifyHeaderCookie'

export const kunGetActions = async (
  params: z.infer<typeof adminReportPaginationSchema>
) => {
  const input = safeParseSchema(adminReportPaginationSchema, params)
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

  const response = await getReport(input)
  return response
}
