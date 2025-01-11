import { kunServerFetchGet } from '~/utils/kunServerFetch'
import { User } from '~/components/admin/user/Container'
import { kunMetadata } from './metadata'
import type { Metadata } from 'next'
import type { AdminUser } from '~/types/api/admin'

export const metadata: Metadata = kunMetadata

export default async function Kun() {
  const { users, total } = await kunServerFetchGet<{
    users: AdminUser[]
    total: number
  }>('/admin/user', {
    page: 1,
    limit: 30
  })

  return <User initialUsers={users} total={total} />
}
