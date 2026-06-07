import { Container } from '~/components/tag/Container'
import { kunMetadata } from './metadata'
import { kunGetActions } from './actions'
import { ErrorComponent } from '~/components/error/ErrorComponent'
import { Suspense } from 'react'
import { getAuthenticatedBlockedTagIds } from '~/utils/actions/getBlockedTagIds'
import type { Metadata } from 'next'

export const revalidate = 120

export const metadata: Metadata = kunMetadata

export default async function Kun() {
  const auth = await getAuthenticatedBlockedTagIds()
  if (!auth) {
    return (
      <Suspense>
        <Container initialTags={[]} initialTotal={0} />
      </Suspense>
    )
  }

  const response = await kunGetActions(
    {
      page: 1,
      limit: 100
    },
    auth.blockedTagIds
  )
  if (typeof response === 'string') {
    return <ErrorComponent error={response} />
  }

  return (
    <Suspense>
      <Container
        initialTags={response.tags}
        initialTotal={response.total}
        uid={auth.payload.uid}
      />
    </Suspense>
  )
}
