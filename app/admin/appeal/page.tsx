import { Suspense } from 'react'
import { Appeal } from '~/components/admin/appeal/Container'
import { kunMetadata } from './metadata'
import { kunGetAppealsActions } from './actions'
import { ErrorComponent } from '~/components/error/ErrorComponent'
import type { Metadata } from 'next'

export const revalidate = 0

export const metadata: Metadata = kunMetadata

export default async function Kun() {
  const response = await kunGetAppealsActions({
    page: 1,
    limit: 30,
    status: 'pending'
  })
  if (typeof response === 'string') {
    return <ErrorComponent error={response} />
  }

  return (
    <Suspense>
      <Appeal initialAppeals={response.appeals} initialTotal={response.total} />
    </Suspense>
  )
}
