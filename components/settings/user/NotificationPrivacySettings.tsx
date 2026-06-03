'use client'

import { EmailNotice } from './EmailNotice'
import { AllowPrivateMessage } from './AllowPrivateMessage'

export const NotificationPrivacySettings = () => {
  return (
    <>
      <EmailNotice />
      <AllowPrivateMessage />
    </>
  )
}
