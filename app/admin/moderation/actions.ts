'use server'

import { z } from 'zod'
import { safeParseSchema } from '~/utils/actions/safeParseSchema'
import { getModerationTasks } from '~/app/api/admin/moderation/get'
import { adminModerationPaginationSchema } from '~/validations/admin'
import { verifyHeaderCookie } from '~/utils/actions/verifyHeaderCookie'

export const kunGetModerationTasksActions = async (
  params: z.infer<typeof adminModerationPaginationSchema>
) => {
  const input = safeParseSchema(adminModerationPaginationSchema, params)
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

  const response = await getModerationTasks(input)
  return response
}
