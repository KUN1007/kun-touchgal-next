'use server'

import { z } from 'zod'
import { safeParseSchema } from '~/utils/actions/safeParseSchema'
import { adminResourcePaginationSchema } from '~/validations/admin'
import { getPatchResource } from '~/app/api/admin/resource/get'
import { getNSFWHeader } from '~/utils/actions/getNSFWHeader'
import { verifyHeaderCookie } from '~/utils/actions/verifyHeaderCookie'

export const kunGetActions = async (
  params: z.infer<typeof adminResourcePaginationSchema>
) => {
  const input = safeParseSchema(adminResourcePaginationSchema, params)
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

  const nsfwEnable = await getNSFWHeader()

  const response = await getPatchResource(input, nsfwEnable)
  return response
}
