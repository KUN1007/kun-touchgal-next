'use server'

import { getOidcClients } from '~/app/api/admin/oidc/service'
import { verifyHeaderCookie } from '~/utils/actions/verifyHeaderCookie'

export const kunGetOidcClients = async () => {
  const payload = await verifyHeaderCookie()
  if (!payload) {
    return '用户登录失效'
  }
  if (payload.role < 4) {
    return '本页面仅超级管理员可访问'
  }

  return getOidcClients()
}
