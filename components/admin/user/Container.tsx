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
import { useEffect, useState, type Key } from 'react'
import { RenderCell } from './RenderCell'
import { kunFetchGet } from '~/utils/kunFetch'
import { KunTableSkeleton } from '~/components/kun/TableSkeleton'
import { useMounted } from '~/hooks/useMounted'
import { useDebounce } from 'use-debounce'
import { KunPagination } from '~/components/kun/Pagination'
import type { AdminUser } from '~/types/api/admin'

type AdminUserSearchType = 'name' | 'email' | 'id'

const columns = [
  { name: '用户', uid: 'user' },
  { name: '角色', uid: 'role' },
  { name: '状态', uid: 'status' },
  { name: '操作', uid: 'actions' }
]

const searchTypeOptions: Array<{
  key: AdminUserSearchType
  label: string
  placeholder: string
}> = [
  { key: 'name', label: '用户名', placeholder: '搜索用户名...' },
  { key: 'email', label: '邮箱', placeholder: '搜索邮箱...' },
  { key: 'id', label: '用户 ID', placeholder: '搜索用户 ID...' }
]

const hiddenLabelClassNames = { label: 'sr-only' }

interface Props {
  initialUsers: AdminUser[]
  initialTotal: number
}

export const User = ({ initialUsers, initialTotal }: Props) => {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(30)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState<AdminUserSearchType>('name')
  const [debouncedQuery] = useDebounce(searchQuery, 500)
  const isMounted = useMounted()

  const [loading, setLoading] = useState(false)
  const fetchData = async () => {
    setLoading(true)

    const { users, total } = await kunFetchGet<{
      users: AdminUser[]
      total: number
    }>('/admin/user', {
      page,
      limit,
      search: debouncedQuery,
      searchType
    })

    setLoading(false)
    setUsers(users)
    setTotal(total)
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchData()
  }, [page, limit, debouncedQuery, searchType])

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    setPage(1)
  }

  const handleSearchTypeChange = (keys: 'all' | Set<Key>) => {
    const key = Array.from(keys)[0] as AdminUserSearchType | undefined
    if (!key) {
      return
    }

    setSearchType(key)
    setPage(1)
  }

  const currentPlaceholder =
    searchTypeOptions.find((option) => option.key === searchType)
      ?.placeholder ?? '搜索用户名...'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">用户管理</h1>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          label="搜索类型"
          labelPlacement="outside-left"
          classNames={hiddenLabelClassNames}
          id="admin-user-search-type"
          className="w-full sm:max-w-40"
          selectedKeys={new Set([searchType])}
          onSelectionChange={handleSearchTypeChange}
        >
          {searchTypeOptions.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>

        <Input
          fullWidth
          isClearable
          placeholder={currentPlaceholder}
          startContent={<Search className="text-default-300" size={20} />}
          value={searchQuery}
          onValueChange={handleSearch}
        />
      </div>

      {loading ? (
        <KunTableSkeleton />
      ) : (
        <Table
          aria-label="用户管理"
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
          <TableBody items={users}>
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
          label="每页显示数量"
          labelPlacement="outside-left"
          classNames={hiddenLabelClassNames}
          id="admin-user-page-size"
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
