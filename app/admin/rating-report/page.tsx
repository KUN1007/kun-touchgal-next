import { Report } from '~/components/admin/report/Container'
import { kunMetadata } from './metadata'
import { kunGetActions } from '~/app/admin/report/actions'
import { ErrorComponent } from '~/components/error/ErrorComponent'
import { Suspense } from 'react'
import type { Metadata } from 'next'

export const revalidate = 0

export const metadata: Metadata = kunMetadata

export default async function Kun() {
  const response = await kunGetActions({
    page: 1,
    limit: 30,
    tab: 'pending',
    targetType: 'rating'
  })
  if (typeof response === 'string') {
    return <ErrorComponent error={response} />
  }

  return (
    <Suspense>
      <Report
        initialReports={response.reports}
        total={response.total}
        title="评价举报管理"
        targetType="rating"
      />
    </Suspense>
  )
}
