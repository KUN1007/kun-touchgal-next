'use client'

import { EmailNotice } from './EmailNotice'
import { AllowPrivateMessage } from './AllowPrivateMessage'
import { BlockedTags } from './BlockedTags'

export const NotificationPrivacySettings = () => {
  return (
    <>
      <EmailNotice />
      <AllowPrivateMessage />
      <BlockedTags />
    </>
  )
}
