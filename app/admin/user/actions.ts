'use server'

import { z } from 'zod'
import { safeParseSchema } from '~/utils/actions/safeParseSchema'
import { adminUserPaginationSchema } from '~/validations/admin'
import { getUserInfo } from '~/app/api/admin/user/get'
import { verifyHeaderCookie } from '~/utils/actions/verifyHeaderCookie'

export const kunGetActions = async (
  params: z.infer<typeof adminUserPaginationSchema>
) => {
  const input = safeParseSchema(adminUserPaginationSchema, params)
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

  const response = await getUserInfo(input)
  return response
}
