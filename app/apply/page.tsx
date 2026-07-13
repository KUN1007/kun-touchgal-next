import { ApplyContainer } from '~/components/apply/Container'
import { redirect } from 'next/navigation'
import { kunMetadata } from './metadata'
import { kunGetActions } from './actions'
import type { Metadata } from 'next'

export const metadata: Metadata = kunMetadata

export default async function Kun() {
  const { count, role } = await kunGetActions()

  if (role > 1) {
    redirect('/apply/success')
  }

  return <ApplyContainer count={count} />
}
