'use client'

import { Email } from './Email'
import { Password } from './Password'
import { LoginSessions } from './LoginSessions'
import { TwoFactorAuth } from './TwoFactorAuth'
import { Reset } from './Reset'

export const AccountSecuritySettings = () => {
  return (
    <>
      <Email />
      <Password />
      <LoginSessions />
      <TwoFactorAuth />
      <Reset />
    </>
  )
}
