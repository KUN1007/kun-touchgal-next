'use client'

import { useEffect, useState } from 'react'
import { kunFetchGet } from '~/utils/kunFetch'
import { KunCardSkeleton } from '~/components/kun/CardSkeleton'
import { useMounted } from '~/hooks/useMounted'
import { LogCard } from './Card'
import toast from 'react-hot-toast'
import { KunPagination } from '~/components/kun/Pagination'
import type { AdminLog } from '~/types/api/admin'

interface Props {
  initialLogs: AdminLog[]
  total: number
}

export const Log = ({ initialLogs, total }: Props) => {
  const [logs, setLogs] = useState<AdminLog[]>(initialLogs)
  const [page, setPage] = useState(1)
  const isMounted = useMounted()

  const [loading, setLoading] = useState(false)
  const fetchData = async () => {
    setLoading(true)

    const response = await kunFetchGet<
      KunResponse<{
        logs: AdminLog[]
        total: number
      }>
    >('/admin/log', {
      page,
      limit: 30
    })
    if (typeof response === 'string') {
      toast.error(response)
    } else {
      setLogs(response.logs)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchData()
  }, [page])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">管理日志</h1>

      <div className="space-y-4">
        {loading ? (
          <KunCardSkeleton count={3} />
        ) : (
          <>
            {logs.map((log) => (
              <LogCard key={log.id} log={log} />
            ))}
          </>
        )}
      </div>

      <div className="flex justify-center">
        <KunPagination
          total={Math.ceil(total / 30)}
          page={page}
          onPageChange={setPage}
          isLoading={loading}
        />
      </div>
    </div>
  )
}
