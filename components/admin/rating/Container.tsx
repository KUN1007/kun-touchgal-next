'use client'

import {
  Autocomplete,
  AutocompleteItem,
  Avatar,
  Button,
  Chip,
  Input,
  Select,
  SelectItem
} from '@heroui/react'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@heroui/modal'
import { Search } from 'lucide-react'
import { useEffect, useState, type Key } from 'react'
import { kunFetchDelete, kunFetchGet } from '~/utils/kunFetch'
import { KunLoading } from '~/components/kun/Loading'
import { useMounted } from '~/hooks/useMounted'
import { RatingCard } from './Card'
import { useDebounce } from 'use-debounce'
import { KunPagination } from '~/components/kun/Pagination'
import type { AdminRating, AdminUser } from '~/types/api/admin'
import toast from 'react-hot-toast'

type AdminRatingSearchType = 'content' | 'user'

const searchTypeOptions: Array<{
  key: AdminRatingSearchType
  label: string
  placeholder: string
}> = [
  { key: 'content', label: '评价内容', placeholder: '输入评价内容搜索评价' },
  { key: 'user', label: '用户名', placeholder: '输入用户名搜索...' }
]

interface UserOption {
  id: number
  name: string
  avatar: string
}

interface Props {
  initialRatings: AdminRating[]
  initialTotal: number
}

export const Rating = ({ initialRatings, initialTotal }: Props) => {
  const [ratings, setRatings] = useState<AdminRating[]>(initialRatings)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(30)
  const [searchType, setSearchType] = useState<AdminRatingSearchType>('content')
  const [selectedRatingIds, setSelectedRatingIds] = useState<Set<number>>(
    new Set()
  )

  const [contentQuery, setContentQuery] = useState('')
  const [debouncedContent] = useDebounce(contentQuery, 500)

  const [userInput, setUserInput] = useState('')
  const [debouncedUserInput] = useDebounce(userInput, 400)
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [userSearchLoading, setUserSearchLoading] = useState(false)

  const isMounted = useMounted()
  const {
    isOpen: isOpenDelete,
    onOpen: onOpenDelete,
    onClose: onCloseDelete
  } = useDisclosure()

  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  const fetchData = async () => {
    setLoading(true)

    try {
      const params: Record<string, string | number> = {
        page,
        limit,
        searchType
      }
      if (searchType === 'content' && debouncedContent) {
        params.search = debouncedContent
      }
      if (searchType === 'user' && selectedUserId) {
        params.userId = selectedUserId
      }

      const response = await kunFetchGet<{
        ratings: AdminRating[]
        total: number
      }>('/admin/rating', params)

      if (typeof response === 'string') {
        toast.error(response)
        return
      }

      const totalPage = Math.max(1, Math.ceil(response.total / limit))
      if (page > totalPage) {
        setPage(totalPage)
        return
      }

      setRatings(response.ratings)
      setTotal(response.total)
      setSelectedRatingIds((prev) => {
        const currentRatingIds = new Set(
          response.ratings.map((rating) => rating.id)
        )
        return new Set(
          [...prev].filter((ratingId) => currentRatingIds.has(ratingId))
        )
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchData()
  }, [page, limit, searchType, debouncedContent, selectedUserId])

  const handleSearchTypeChange = (keys: 'all' | Set<Key>) => {
    const key = Array.from(keys)[0] as AdminRatingSearchType | undefined
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

  const handleRatingSelectionChange = (
    ratingId: number,
    isSelected: boolean
  ) => {
    setSelectedRatingIds((prev) => {
      const next = new Set(prev)
      if (isSelected) {
        next.add(ratingId)
      } else {
        next.delete(ratingId)
      }
      return next
    })
  }

  const handleToggleSelectAll = () => {
    setSelectedRatingIds((prev) => {
      const next = new Set(prev)
      const isAllSelected =
        ratings.length > 0 && ratings.every((rating) => prev.has(rating.id))

      ratings.forEach((rating) => {
        if (isAllSelected) {
          next.delete(rating.id)
        } else {
          next.add(rating.id)
        }
      })

      return next
    })
  }

  const handleClearSelection = () => {
    setSelectedRatingIds(new Set())
  }

  const handleBatchDelete = async () => {
    if (!selectedRatingIds.size) {
      return
    }

    const deleteCount = selectedRatingIds.size
    setDeleting(true)
    try {
      const res = await kunFetchDelete<KunResponse<{}>>('/admin/rating', {
        ratingIds: Array.from(selectedRatingIds).join(',')
      })

      if (typeof res === 'string') {
        toast.error(res)
        return
      }

      onCloseDelete()
      setSelectedRatingIds(new Set())
      toast.success(`已删除 ${deleteCount} 条评价`)
      await fetchData()
    } finally {
      setDeleting(false)
    }
  }

  const currentPlaceholder =
    searchTypeOptions.find((option) => option.key === searchType)
      ?.placeholder ?? ''
  const isAllSelected =
    ratings.length > 0 &&
    ratings.every((rating) => selectedRatingIds.has(rating.id))

  if (!isMounted) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">评价管理</h1>
        <KunLoading hint="正在获取评价数据..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">评价管理</h1>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row xl:flex-1">
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

        <div className="flex flex-wrap items-center gap-2">
          {selectedRatingIds.size ? (
            <Chip color="primary" variant="flat">
              {`已选择 ${selectedRatingIds.size} 条`}
            </Chip>
          ) : null}
          <Button
            variant="flat"
            onPress={handleToggleSelectAll}
            isDisabled={!ratings.length || loading}
          >
            {isAllSelected ? '取消全选' : '全选当前页'}
          </Button>
          <Button
            variant="light"
            onPress={handleClearSelection}
            isDisabled={!selectedRatingIds.size || loading}
          >
            清空选择
          </Button>
          <Button
            color="danger"
            onPress={onOpenDelete}
            isDisabled={!selectedRatingIds.size || loading}
          >
            批量删除
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <KunLoading hint="正在获取评价数据..." />
        ) : ratings.length ? (
          <>
            {ratings.map((rating) => (
              <RatingCard
                key={rating.id}
                rating={rating}
                isSelected={selectedRatingIds.has(rating.id)}
                isSelectionDisabled={deleting}
                onSelectionChange={(isSelected) =>
                  handleRatingSelectionChange(rating.id, isSelected)
                }
                onRefresh={fetchData}
              />
            ))}
          </>
        ) : (
          <div className="py-12 text-center text-default-500">暂无评价</div>
        )}
      </div>

      <div className="flex justify-center">
        <KunPagination
          total={Math.ceil(total / limit)}
          page={page}
          onPageChange={setPage}
          isLoading={loading}
        />
      </div>

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

      <Modal isOpen={isOpenDelete} onClose={onCloseDelete} placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            批量删除评价
          </ModalHeader>
          <ModalBody>
            <p>
              您确定要删除已选择的 {selectedRatingIds.size} 条评价吗?
              该操作不可撤销
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCloseDelete}>
              取消
            </Button>
            <Button
              color="danger"
              onPress={handleBatchDelete}
              isLoading={deleting}
              disabled={deleting}
            >
              删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
