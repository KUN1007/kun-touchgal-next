import { OidcClientContainer } from '~/components/admin/oidc/Container'
import { kunMetadata } from './metadata'
import { kunGetOidcClients } from './actions'
import { ErrorComponent } from '~/components/error/ErrorComponent'
import type { Metadata } from 'next'

export const revalidate = 0

export const metadata: Metadata = kunMetadata

export default async function Kun() {
  const response = await kunGetOidcClients()
  if (typeof response === 'string') {
    return <ErrorComponent error={response} />
  }

  return <OidcClientContainer initialClients={response} />
}
