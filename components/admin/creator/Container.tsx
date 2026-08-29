'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow
} from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import { RenderCell } from './RenderCell'
import { kunFetchGet } from '~/utils/kunFetch'
import { errorReporter } from '~/utils/kunErrorHandler'
import { KunTableSkeleton } from '~/components/kun/TableSkeleton'
import { useMounted } from '~/hooks/useMounted'
import { KunPagination } from '~/components/kun/Pagination'
import type { AdminCreator } from '~/types/api/admin'
import toast from 'react-hot-toast'

interface Props {
  initialCreators: AdminCreator[]
  initialTotal: number
}

const columns = [
  { name: '申请人', uid: 'sender' },
  { name: '状态', uid: 'status' },
  { name: '时间', uid: 'created' },
  { name: '操作', uid: 'actions' }
]

const limit = 30

export const Creator = ({ initialCreators, initialTotal }: Props) => {
  const [creators, setCreators] = useState<AdminCreator[]>(initialCreators)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const isMounted = useMounted()

  const [loading, setLoading] = useState(false)
  const latestFetchRequestIdRef = useRef(0)
  const fetchData = async () => {
    const requestId = latestFetchRequestIdRef.current + 1
    latestFetchRequestIdRef.current = requestId
    setLoading(true)
    try {
      const res = await kunFetchGet<
        KunResponse<{
          creators: AdminCreator[]
          total: number
        }>
      >('/admin/creator', {
        page,
        limit
      })
      if (requestId !== latestFetchRequestIdRef.current) {
        return
      }
      if (typeof res === 'string') {
        toast.error(res)
        return
      }
      setCreators(res.creators)
      setTotal(res.total)
    } catch (error) {
      if (requestId !== latestFetchRequestIdRef.current) {
        return
      }
      errorReporter(error)
    } finally {
      if (requestId === latestFetchRequestIdRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchData()
  }, [page])

  // 同意/拒绝后就地更新该行状态 (2 - 同意, 3 - 拒绝), 不整表刷新
  const handleCreatorUpdated = (creatorId: number, status: number) => {
    setCreators((prev) =>
      prev.map((creator) =>
        creator.id === creatorId ? { ...creator, status } : creator
      )
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="mb-6 text-2xl font-bold">创作者管理</h1>
      {loading ? (
        <KunTableSkeleton />
      ) : (
        <Table
          aria-label="创作者管理"
          bottomContent={
            <div className="flex justify-center w-full">
              <KunPagination
                page={page}
                total={Math.ceil(total / limit)}
                onPageChange={setPage}
                isLoading={loading}
              />
            </div>
          }
        >
          <TableHeader columns={columns}>
            {(column) => (
              <TableColumn key={column.uid}>{column.name}</TableColumn>
            )}
          </TableHeader>
          <TableBody>
            {creators.map((creator) => (
              <TableRow key={creator.id}>
                {(columnKey) => (
                  <TableCell>
                    {RenderCell({
                      creator,
                      columnKey: columnKey.toString(),
                      onUpdate: handleCreatorUpdated
                    })}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
