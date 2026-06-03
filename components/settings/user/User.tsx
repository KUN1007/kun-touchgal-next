import { KunHeader } from '~/components/kun/Header'
import { UserAvatar } from './Avatar'
import { Username } from './Username'
import { Bio } from './Bio'
import { LazyUserSettingsSections } from './LazyUserSettingsSections'

export const UserSettings = () => {
  return (
    <div className="w-full my-4">
      <KunHeader name="账户设置" description="您可以在此处设置您的账户信息" />

      <div className="max-w-3xl m-auto space-y-8">
        <UserAvatar />
        <Username />
        <Bio />
        <LazyUserSettingsSections />
      </div>
    </div>
  )
}
