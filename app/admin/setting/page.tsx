import { AdminSetting } from '~/components/admin/setting/Container'
import { kunMetadata } from './metadata'
import {
  kunGetDisableRegisterStatusActions,
  kunGetModerationSettingActions,
  kunGetRedirectConfigActions
} from './actions'
import { ErrorComponent } from '~/components/error/ErrorComponent'
import type { Metadata } from 'next'

export const revalidate = 0

export const metadata: Metadata = kunMetadata

export default async function Kun() {
  const [setting, response, moderation] = await Promise.all([
    kunGetRedirectConfigActions(),
    kunGetDisableRegisterStatusActions(),
    kunGetModerationSettingActions()
  ])

  if (
    typeof response === 'string' ||
    typeof setting === 'string' ||
    typeof moderation === 'string'
  ) {
    const errorText =
      typeof response === 'string'
        ? response
        : typeof setting === 'string'
          ? setting
          : typeof moderation === 'string'
            ? moderation
            : ''
    return <ErrorComponent error={errorText} />
  }

  return (
    <AdminSetting
      setting={setting}
      disableRegister={response.disableRegister}
      moderation={moderation}
    />
  )
}
