'use server'

import { getRedirectConfig } from '~/app/api/admin/setting/redirect/getRedirectConfig'
import { getDisableRegisterStatus } from '~/app/api/admin/setting/register/service'
import { getModerationSetting } from '~/app/api/admin/setting/moderation/service'
import { verifyHeaderCookie } from '~/utils/actions/verifyHeaderCookie'

export const kunGetRedirectConfigActions = async () => {
  const payload = await verifyHeaderCookie()
  if (!payload) {
    return '用户登录失效'
  }
  if (payload.role < 4) {
    return '本页面仅超级管理员可访问'
  }

  const response = await getRedirectConfig()
  return response
}

export const kunGetDisableRegisterStatusActions = async () => {
  const payload = await verifyHeaderCookie()
  if (!payload) {
    return '用户登录失效'
  }
  if (payload.role < 4) {
    return '本页面仅超级管理员可访问'
  }

  const response = await getDisableRegisterStatus()
  return response
}

export const kunGetModerationSettingActions = async () => {
  const payload = await verifyHeaderCookie()
  if (!payload) {
    return '用户登录失效'
  }
  if (payload.role < 4) {
    return '本页面仅超级管理员可访问'
  }

  const response = await getModerationSetting()
  return response
}
