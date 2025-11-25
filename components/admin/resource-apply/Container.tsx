'use client'

import {
  Chip,
  Input,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow
} from '@heroui/react'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { kunFetchGet } from '~/utils/kunFetch'
import { useMounted } from '~/hooks/useMounted'
import { KunLoading } from '~/components/kun/Loading'
import { KunPagination } from '~/components/kun/Pagination'
import { RenderCell } from './RenderCell'
import type { AdminResource } from '~/types/api/admin'

const columns = [
  { name: '资源', id: 'name' },
  { name: '上传用户', id: 'user' },
  { name: '存储方式', id: 'storage' },
  { name: '大小', id: 'size' },
  { name: '状态', id: 'status' },
  { name: '创建时间', id: 'created' },
  { name: '操作', id: 'actions' }
]

interface Props {
  initialResources: AdminResource[]
  initialTotal: number
}

export const ResourceApply = ({ initialResources, initialTotal }: Props) => {
  const [resources, setResources] = useState<AdminResource[]>(initialResources)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 500)
  const isMounted = useMounted()

  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const { resources, total } = await kunFetchGet<{
      resources: AdminResource[]
      total: number
    }>('/admin/resource-apply', {
      page,
      limit: 30,
      search: debouncedQuery
    })

    setLoading(false)
    setResources(resources)
    setTotal(total)
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }

    fetchData()
  }, [page, debouncedQuery])

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">资源首次发布申请</h1>
        <Chip color="primary" variant="flat">
          仅展示等待审核的用户首次资源
        </Chip>
      </div>

      <Input
        fullWidth
        isClearable
        placeholder="输入资源链接（或 BLAKE3 Hash），按回车搜索待审核资源"
        startContent={<Search className="text-default-300" size={20} />}
        value={searchQuery}
        onValueChange={handleSearch}
      />

      {loading ? (
        <KunLoading hint="正在加载待审核资源..." />
      ) : (
        <Table
          aria-label="资源发布申请列表"
          bottomContent={
            <div className="flex justify-center w-full">
              <KunPagination
                total={Math.ceil(total / 30)}
                onPageChange={setPage}
                isLoading={loading}
                page={page}
              />
            </div>
          }
        >
          <TableHeader columns={columns}>
            {(column) => (
              <TableColumn key={column.id}>{column.name}</TableColumn>
            )}
          </TableHeader>
          <TableBody items={resources}>
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
    </div>
  )
}
