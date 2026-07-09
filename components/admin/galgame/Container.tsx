'use client'

import {
  Input,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow
} from '@heroui/react'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { RenderCell } from './RenderCell'
import { kunFetchGet } from '~/utils/kunFetch'
import { KunTableSkeleton } from '~/components/kun/TableSkeleton'
import { useMounted } from '~/hooks/useMounted'
import { useDebounce } from 'use-debounce'
import { KunPagination } from '~/components/kun/Pagination'
import type { AdminGalgame } from '~/types/api/admin'

const columns = [
  { name: '封面', uid: 'banner' },
  { name: '标题', uid: 'name' },
  { name: '用户', uid: 'user' },
  { name: '时间', uid: 'created' }
]

interface Props {
  initialGalgames: AdminGalgame[]
  initialTotal: number
}

export const Galgame = ({ initialGalgames, initialTotal }: Props) => {
  const [galgames, setGalgames] = useState<AdminGalgame[]>(initialGalgames)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(30)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 500)
  const isMounted = useMounted()

  const [loading, setLoading] = useState(false)
  const fetchData = async () => {
    setLoading(true)

    const { galgames, total } = await kunFetchGet<{
      galgames: AdminGalgame[]
      total: number
    }>('/admin/galgame', {
      page,
      limit,
      search: debouncedQuery
    })

    setLoading(false)
    setGalgames(galgames)
    setTotal(total)
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchData()
  }, [page, limit, debouncedQuery])

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Galgame 管理</h1>

      <Input
        fullWidth
        isClearable
        placeholder="输入 Galgame 名搜索 Galgame"
        startContent={<Search className="text-default-300" size={20} />}
        value={searchQuery}
        onValueChange={handleSearch}
      />

      {loading ? (
        <KunTableSkeleton />
      ) : (
        <Table
          aria-label="Galgame 管理"
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
          <TableBody items={galgames}>
            {(item) => (
              <TableRow key={item.id}>
                {(columnKey) => (
                  <TableCell>
                    {RenderCell(item, columnKey.toString())}
                  </TableCell>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center justify-center gap-2 text-sm text-default-500">
        <span>每页显示</span>
        <Select
          aria-label="每页显示数量"
          size="sm"
          className="w-20"
          selectedKeys={new Set([String(limit)])}
          onSelectionChange={(keys) => {
            const val = Number(Array.from(keys)[0])
            if (val && val !== limit) {
              setLimit(val)
              setPage(1)
            }
          }}
        >
          <SelectItem key="30">30</SelectItem>
          <SelectItem key="50">50</SelectItem>
          <SelectItem key="100">100</SelectItem>
          <SelectItem key="500">500</SelectItem>
        </Select>
        <span>条，共 {total} 条</span>
      </div>
    </div>
  )
}
