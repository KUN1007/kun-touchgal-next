import { Suspense } from 'react'
import { UserSettings } from '~/components/settings/user/User'
import { kunMetadata } from './metadata'
import type { Metadata } from 'next'

export const metadata: Metadata = kunMetadata

export default function User() {
  return (
    <Suspense>
      <UserSettings />
    </Suspense>
  )
}
