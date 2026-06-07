import { SearchPage } from '~/components/search/Container'
import { kunMetadata } from './metadata'
import { getCurrentSiteYear } from '~/utils/time'
import { Suspense } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = kunMetadata

export default function Search() {
  return (
    <Suspense>
      <SearchPage filterEndYear={getCurrentSiteYear()} />
    </Suspense>
  )
}
