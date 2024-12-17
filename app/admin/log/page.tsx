import { Log } from '~/components/admin/log/Container'
import { kunServerFetchGet } from '~/utils/kunServerFetch'
import { ErrorComponent } from '~/components/error/ErrorComponent'
import { kunMetadata } from './metadata'
import type { AdminLog } from '~/types/api/admin'
import type { Metadata } from 'next'

export const metadata: Metadata = kunMetadata

export default async function Kun() {
  const response = await kunServerFetchGet<{
    logs: AdminLog[]
    total: number
  }>('/admin/log', {
    page: 1,
    limit: 100
  })

  if (typeof response === 'string') {
    return <ErrorComponent error={response} />
  }

  return <Log initialLogs={response.logs} total={response.total} />
}
