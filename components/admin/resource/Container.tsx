'use client'

import {
  Autocomplete,
  AutocompleteItem,
  Avatar,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  useDisclosure
} from '@heroui/react'
import { ChevronDown, Eye, EyeOff, Search, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { kunFetchDelete, kunFetchGet, kunFetchPut } from '~/utils/kunFetch'
import { useEffect, useState, type Key } from 'react'
import type { Selection } from '@heroui/table'
import { useMounted } from '~/hooks/useMounted'
import { KunTableSkeleton } from '~/components/kun/TableSkeleton'
import { RenderCell } from './RenderCell'
import { useDebounce } from 'use-debounce'
import { KunPagination } from '~/components/kun/Pagination'
import type { AdminResource, AdminUser } from '~/types/api/admin'

type ResourceSearchType = 'content' | 'user'

const columns = [
  { name: '资源', id: 'name' },
  { name: '用户', id: 'user' },
  { name: '存储', id: 'storage' },
  { name: '大小', id: 'size' },
  { name: '创建时间', id: 'created' },
  { name: '状态', id: 'status' },
  { name: '操作', id: 'actions' }
]

const searchTypeOptions: Array<{
  key: ResourceSearchType
  label: string
  placeholder: string
}> = [
  {
    key: 'content',
    label: '资源链接',
    placeholder: '输入资源链接（或 BLAKE3 Hash）搜索'
  },
  { key: 'user', label: '用户名', placeholder: '输入用户名搜索...' }
]

interface UserOption {
  id: number
  name: string
  avatar: string
}

interface Props {
  initialResources: AdminResource[]
  initialTotal: number
}

export const Resource = ({ initialResources, initialTotal }: Props) => {
  const [resources, setResources] = useState<AdminResource[]>(initialResources)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(30)
  const [searchType, setSearchType] = useState<ResourceSearchType>('content')
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set())
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [batchHiding, setBatchHiding] = useState(false)
  const {
    isOpen: isBatchOpen,
    onOpen: onBatchOpen,
    onClose: onBatchClose
  } = useDisclosure()

  const [contentQuery, setContentQuery] = useState('')
  const [debouncedContent] = useDebounce(contentQuery, 500)

  const [userInput, setUserInput] = useState('')
  const [debouncedUserInput] = useDebounce(userInput, 400)
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [userSearchLoading, setUserSearchLoading] = useState(false)

  const isMounted = useMounted()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!debouncedUserInput.trim()) {
      setUserOptions([])
      return
    }
    let cancelled = false
    const fetchUsers = async () => {
      setUserSearchLoading(true)
      try {
        const res = await kunFetchGet<{
          users: AdminUser[]
          total: number
        }>('/admin/user', {
          page: 1,
          limit: 10,
          search: debouncedUserInput,
          searchType: 'name'
        })
        if (!cancelled) {
          if (typeof res === 'string') {
            toast.error(res)
          } else {
            setUserOptions(
              res.users.map((u) => ({
                id: u.id,
                name: u.name,
                avatar: u.avatar
              }))
            )
          }
        }
      } finally {
        if (!cancelled) {
          setUserSearchLoading(false)
        }
      }
    }
    fetchUsers()
    return () => {
      cancelled = true
    }
  }, [debouncedUserInput])

  useEffect(() => {
    if (!isMounted) {
      return
    }
    const fetchData = async () => {
      setLoading(true)
      try {
        const params: Record<string, string | number> = { page, limit }
        if (searchType === 'content' && debouncedContent) {
          params.search = debouncedContent
        }
        if (searchType === 'user' && selectedUserId) {
          params.userId = selectedUserId
        }

        const res = await kunFetchGet<{
          resources: AdminResource[]
          total: number
        }>('/admin/resource', params)

        if (typeof res === 'string') {
          toast.error(res)
          return
        }

        setResources(res.resources)
        setTotal(res.total)
        setSelectedKeys(new Set<string | number>())
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [page, limit, searchType, debouncedContent, selectedUserId])

  const selectedCount =
    selectedKeys === 'all' ? resources.length : selectedKeys.size

  const handleBatchDelete = async () => {
    setBatchDeleting(true)
    const ids =
      selectedKeys === 'all'
        ? resources.map((r) => r.id)
        : Array.from(selectedKeys).map(Number)

    const results = await Promise.allSettled(
      ids.map((id) =>
        kunFetchDelete<KunResponse<{}>>('/admin/resource', { resourceId: id })
      )
    )

    const failed = results.filter(
      (r) =>
        r.status === 'rejected' ||
        (r.status === 'fulfilled' && typeof r.value === 'string')
    ).length
    const succeeded = results.length - failed

    if (succeeded > 0) {
      toast.success(`成功删除 ${succeeded} 条资源`)
    }
    if (failed > 0) {
      toast.error(`${failed} 条资源删除失败`)
    }

    setBatchDeleting(false)
    onBatchClose()
    setSelectedKeys(new Set<string | number>())

    // 刷新列表
    const params: Record<string, string | number> = { page, limit }
    if (searchType === 'content' && debouncedContent) {
      params.search = debouncedContent
    }
    if (searchType === 'user' && selectedUserId) {
      params.userId = selectedUserId
    }
    const refreshRes = await kunFetchGet<{
      resources: AdminResource[]
      total: number
    }>('/admin/resource', params)
    if (typeof refreshRes === 'string') {
      toast.error(refreshRes)
    } else {
      setResources(refreshRes.resources)
      setTotal(refreshRes.total)
    }
  }

  const handleBatchStatus = async (status: 0 | 1) => {
    setBatchHiding(true)
    const ids =
      selectedKeys === 'all'
        ? resources.map((r) => r.id)
        : Array.from(selectedKeys).map(Number)

    const res = await kunFetchPut<KunResponse<{ count: number }>>(
      '/admin/resource/hidden',
      { resourceIds: ids.join(','), status }
    )

    const actionLabel = status === 0 ? '恢复' : '隐藏'
    if (typeof res === 'string') {
      toast.error(res)
    } else {
      toast.success(`成功${actionLabel} ${res.count} 条资源`)
    }

    setBatchHiding(false)
    setSelectedKeys(new Set<string | number>())

    // 刷新列表
    const params: Record<string, string | number> = { page, limit }
    if (searchType === 'content' && debouncedContent) {
      params.search = debouncedContent
    }
    if (searchType === 'user' && selectedUserId) {
      params.userId = selectedUserId
    }
    const refreshRes = await kunFetchGet<{
      resources: AdminResource[]
      total: number
    }>('/admin/resource', params)
    if (typeof refreshRes === 'string') {
      toast.error(refreshRes)
    } else {
      setResources(refreshRes.resources)
      setTotal(refreshRes.total)
    }
  }

  const handleSearchTypeChange = (keys: 'all' | Set<Key>) => {
    const key = Array.from(keys)[0] as ResourceSearchType | undefined
    if (!key) {
      return
    }
    setSearchType(key)
    setPage(1)
    setContentQuery('')
    setUserInput('')
    setSelectedUserId(null)
    setUserOptions([])
  }

  const handleContentSearch = (value: string) => {
    setContentQuery(value)
    setPage(1)
  }

  const handleUserSelectionChange = (key: Key | null) => {
    if (!key) {
      setSelectedUserId(null)
    } else {
      setSelectedUserId(Number(key))
    }
    setPage(1)
  }

  const handleUserInputChange = (value: string) => {
    setUserInput(value)
    if (!value) {
      setSelectedUserId(null)
      setPage(1)
    }
  }

  const currentPlaceholder =
    searchTypeOptions.find((o) => o.key === searchType)?.placeholder ?? ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">下载资源管理</h1>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <>
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    color="warning"
                    variant="flat"
                    size="sm"
                    endContent={<ChevronDown size={14} />}
                    isLoading={batchHiding}
                  >
                    修改状态 ({selectedCount})
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="批量修改资源状态"
                  onAction={(key) => handleBatchStatus(Number(key) as 0 | 1)}
                >
                  <DropdownItem key="1" startContent={<EyeOff size={14} />}>
                    隐藏
                  </DropdownItem>
                  <DropdownItem key="0" startContent={<Eye size={14} />}>
                    恢复
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
              <Button
                color="danger"
                variant="flat"
                size="sm"
                startContent={<Trash2 size={14} />}
                onPress={onBatchOpen}
              >
                批量删除 ({selectedCount})
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          aria-label="搜索类型"
          className="w-full sm:max-w-40"
          selectedKeys={new Set([searchType])}
          onSelectionChange={handleSearchTypeChange}
        >
          {searchTypeOptions.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>

        {searchType === 'user' ? (
          <Autocomplete
            fullWidth
            isClearable
            placeholder={currentPlaceholder}
            startContent={<Search className="text-default-300" size={20} />}
            inputValue={userInput}
            isLoading={userSearchLoading}
            items={userOptions}
            onInputChange={handleUserInputChange}
            onSelectionChange={handleUserSelectionChange}
          >
            {(user) => (
              <AutocompleteItem key={user.id} textValue={user.name}>
                <div className="flex items-center gap-2">
                  <Avatar
                    src={user.avatar}
                    size="sm"
                    showFallback
                    name={user.name.charAt(0).toUpperCase()}
                  />
                  <span>{user.name}</span>
                </div>
              </AutocompleteItem>
            )}
          </Autocomplete>
        ) : (
          <Input
            fullWidth
            isClearable
            placeholder={currentPlaceholder}
            startContent={<Search className="text-default-300" size={20} />}
            value={contentQuery}
            onValueChange={handleContentSearch}
          />
        )}
      </div>

      {loading ? (
        <KunTableSkeleton />
      ) : (
        <Table
          aria-label="资源管理列表"
          selectionMode="multiple"
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          bottomContent={
            <div className="flex justify-center w-full">
              <KunPagination
                total={Math.ceil(total / limit)}
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
          <TableBody>
            {resources.map((item) => (
              <TableRow key={item.id}>
                {columns.map((column) => (
                  <TableCell key={column.id}>
                    {RenderCell(item, column.id)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
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

      <Modal isOpen={isBatchOpen} onClose={onBatchClose} placement="center">
        <ModalContent>
          <ModalHeader>批量删除资源</ModalHeader>
          <ModalBody>
            <p>
              您确定要删除选中的 <strong>{selectedCount}</strong>{' '}
              条资源吗？该操作不可撤销。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onBatchClose}>
              取消
            </Button>
            <Button
              color="danger"
              onPress={handleBatchDelete}
              isLoading={batchDeleting}
            >
              确认删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
