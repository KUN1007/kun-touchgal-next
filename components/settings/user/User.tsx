import { KunHeader } from '~/components/kun/Header'
import { UserAvatar } from './Avatar'
import { Username } from './Username'
import { Bio } from './Bio'
import { Email } from './Email'
import { Password } from './Password'
import { EmailNotice } from './EmailNotice'
import { TwoFactorAuth } from './TwoFactorAuth'
import { Reset } from './Reset'

export const UserSettings = () => {
  return (
    <div className="w-full my-4">
      <KunHeader name="账户设置" description="您可以在此处设置您的账户信息" />

      <div className="max-w-3xl m-auto space-y-8">
        <UserAvatar />
        <Username />
        <Bio />
        <Email />
        <Password />
        <EmailNotice />
        <TwoFactorAuth />
        <Reset />
      </div>
    </div>
  )
}
