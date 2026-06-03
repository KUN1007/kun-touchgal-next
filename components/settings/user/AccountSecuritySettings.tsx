'use client'

import { Email } from './Email'
import { Password } from './Password'
import { TwoFactorAuth } from './TwoFactorAuth'
import { Reset } from './Reset'

export const AccountSecuritySettings = () => {
  return (
    <>
      <Email />
      <Password />
      <TwoFactorAuth />
      <Reset />
    </>
  )
}
