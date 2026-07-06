import { Divider } from '@heroui/divider'
import { RedirectSetting } from './RedirectSetting'
import { DisableRegisterSetting } from './DisableRegisterSetting'
import { ModerationSetting } from './ModerationSetting'
import type { AdminRedirectConfig } from '~/types/api/admin'

interface Props {
  setting: AdminRedirectConfig
  disableRegister: boolean
  moderation: { enabled: boolean; dryRun: boolean }
}

export const AdminSetting = ({
  setting,
  disableRegister,
  moderation
}: Props) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">网站设置</h1>
      </div>

      <RedirectSetting setting={setting} />

      <Divider />

      <DisableRegisterSetting disableRegister={disableRegister} />

      <Divider />

      <ModerationSetting
        enabled={moderation.enabled}
        dryRun={moderation.dryRun}
      />
    </div>
  )
}
