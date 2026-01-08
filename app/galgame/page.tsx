import { CardContainer } from '~/components/galgame/Container'
import { kunMetadata } from './metadata'
import { Suspense } from 'react'
import { kunGetActions } from './actions'
import { ErrorComponent } from '~/components/error/ErrorComponent'
import type { Metadata } from 'next'

export const revalidate = 3

export const metadata: Metadata = kunMetadata

export default async function Kun() {
  const response = await kunGetActions({
    selectedType: 'all',
    selectedLanguage: 'all',
    selectedPlatform: 'all',
    sortField: 'resource_update_time',
    sortOrder: 'desc',
    page: 1,
    limit: 24,
    yearString: JSON.stringify(['all']),
    monthString: JSON.stringify(['all']),
    minRatingCount: 0
  })
  if (typeof response === 'string') {
    return <ErrorComponent error={response} />
  }

  return (
    <Suspense>
      <CardContainer
        initialGalgames={response.galgames}
        initialTotal={response.total}
      />
    </Suspense>
  )
}
