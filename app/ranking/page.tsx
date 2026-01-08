import { RankingContainer } from '~/components/ranking/RankingContainer'
import { kunGetRankingActions } from './actions'
import { ErrorComponent } from '~/components/error/ErrorComponent'
import { kunMetadata } from './metadata'
import type { Metadata } from 'next'

const DEFAULT_MIN_COUNT = 10
const PAGE_SIZE = 48

export const revalidate = 3

export const metadata: Metadata = kunMetadata

export default async function RankingPage() {
  const response = await kunGetRankingActions({
    sortField: 'rating',
    sortOrder: 'desc',
    minRatingCount: DEFAULT_MIN_COUNT,
    page: 1,
    limit: PAGE_SIZE
  })

  if (typeof response === 'string') {
    return <ErrorComponent error={response} />
  }

  return (
    <RankingContainer
      initialGalgames={response.galgames}
      initialTotal={response.total}
      initialSortField="rating"
      initialSortOrder="desc"
      initialMinRatingCount={DEFAULT_MIN_COUNT}
      pageSize={PAGE_SIZE}
    />
  )
}
