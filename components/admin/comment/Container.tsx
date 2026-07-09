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
import { KunCardSkeleton } from '~/components/kun/CardSkeleton'
import { useMounted } from '~/hooks/useMounted'
import { CommentCard } from './Card'
import { useDebounce } from 'use-debounce'
import { KunPagination } from '~/components/kun/Pagination'
import type { AdminComment, AdminUser } from '~/types/api/admin'
import toast from 'react-hot-toast'

type AdminCommentSearchType = 'content' | 'user'

const searchTypeOptions: Array<{
  key: AdminCommentSearchType
  label: string
  placeholder: string
}> = [
  { key: 'content', label: '评论内容', placeholder: '输入评论内容搜索评论' },
  { key: 'user', label: '用户名', placeholder: '输入用户名搜索...' }
]

interface UserOption {
  id: number
  name: string
  avatar: string
}

interface Props {
  initialComments: AdminComment[]
  initialTotal: number
}

export const Comment = ({ initialComments, initialTotal }: Props) => {
  const [comments, setComments] = useState<AdminComment[]>(initialComments)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(30)
  const [searchType, setSearchType] =
    useState<AdminCommentSearchType>('content')
  const [selectedCommentIds, setSelectedCommentIds] = useState<Set<number>>(
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
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState('')

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
    setError('')

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

      const response = await kunFetchGet<
        KunResponse<{
          comments: AdminComment[]
          total: number
        }>
      >('/admin/comment', params)
      if (typeof response === 'string') {
        setError(response)
        return
      }

      const totalPage = Math.max(1, Math.ceil(response.total / limit))
      if (page > totalPage) {
        setPage(totalPage)
        return
      }

      setComments(response.comments)
      setTotal(response.total)
      setSelectedCommentIds((prev) => {
        const currentCommentIds = new Set(
          response.comments.map((comment) => comment.id)
        )
        return new Set(
          [...prev].filter((commentId) => currentCommentIds.has(commentId))
        )
      })
    } catch {
      setError('网络错误, 请稍后重试')
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
    const key = Array.from(keys)[0] as AdminCommentSearchType | undefined
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

  const handleCommentSelectionChange = (
    commentId: number,
    isSelected: boolean
  ) => {
    setSelectedCommentIds((prev) => {
      const next = new Set(prev)
      if (isSelected) {
        next.add(commentId)
      } else {
        next.delete(commentId)
      }
      return next
    })
  }

  const handleToggleSelectAll = () => {
    setSelectedCommentIds((prev) => {
      const next = new Set(prev)
      const isAllSelected =
        comments.length > 0 && comments.every((comment) => prev.has(comment.id))

      comments.forEach((comment) => {
        if (isAllSelected) {
          next.delete(comment.id)
        } else {
          next.add(comment.id)
        }
      })

      return next
    })
  }

  const handleClearSelection = () => {
    setSelectedCommentIds(new Set())
  }

  const handleBatchDelete = async () => {
    if (!selectedCommentIds.size) {
      return
    }

    const ids = Array.from(selectedCommentIds)
    const chunkSize = 100
    setDeleting(true)
    try {
      let deletedCount = 0
      const failedIds: number[] = []
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize)
        setDeleteProgress(
          `${Math.min(i + chunkSize, ids.length)} / ${ids.length}`
        )
        try {
          const res = await kunFetchDelete<KunResponse<{}>>('/admin/comment', {
            commentIds: chunk.join(',')
          })
          if (typeof res === 'string') {
            failedIds.push(...chunk)
          } else {
            deletedCount += chunk.length
          }
        } catch {
          failedIds.push(...chunk)
        }
      }

      if (failedIds.length) {
        setSelectedCommentIds(new Set(failedIds))
        toast.error(
          `已删除 ${deletedCount} 条, ${failedIds.length} 条删除失败, 已保留选中可重试`
        )
      } else {
        onCloseDelete()
        setSelectedCommentIds(new Set())
        toast.success(`已删除 ${deletedCount} 条评论`)
      }
      await fetchData()
    } finally {
      setDeleting(false)
      setDeleteProgress('')
    }
  }

  const currentPlaceholder =
    searchTypeOptions.find((option) => option.key === searchType)
      ?.placeholder ?? ''
  const isAllSelected =
    comments.length > 0 &&
    comments.every((comment) => selectedCommentIds.has(comment.id))

  if (!isMounted) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">评论管理</h1>
        <KunCardSkeleton count={3} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">评论管理</h1>

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
          {selectedCommentIds.size ? (
            <Chip color="primary" variant="flat">
              {`已选择 ${selectedCommentIds.size} 条`}
            </Chip>
          ) : null}
          <Button
            variant="flat"
            onPress={handleToggleSelectAll}
            isDisabled={!comments.length || loading}
          >
            {isAllSelected ? '取消全选' : '全选当前页'}
          </Button>
          <Button
            variant="light"
            onPress={handleClearSelection}
            isDisabled={!selectedCommentIds.size || loading}
          >
            清空选择
          </Button>
          <Button
            color="danger"
            onPress={onOpenDelete}
            isDisabled={!selectedCommentIds.size || loading}
          >
            批量删除
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <KunCardSkeleton count={3} />
        ) : error ? (
          <div className="space-y-3 py-12 text-center">
            <p className="text-danger">{error}</p>
            <Button variant="flat" onPress={() => fetchData()}>
              重试
            </Button>
          </div>
        ) : comments.length ? (
          <>
            {comments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                isSelected={selectedCommentIds.has(comment.id)}
                isSelectionDisabled={deleting}
                onSelectionChange={(isSelected) =>
                  handleCommentSelectionChange(comment.id, isSelected)
                }
                onRefresh={fetchData}
              />
            ))}
          </>
        ) : (
          <div className="space-y-1 py-12 text-center">
            <p className="text-default-600">暂无评论</p>
            <p className="text-sm text-default-500">
              没有找到符合条件的评论, 可切换搜索类型或修改关键词重试
            </p>
          </div>
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
            批量删除评论
          </ModalHeader>
          <ModalBody>
            <p>
              您确定要删除已选择的 {selectedCommentIds.size} 条评论吗?
              如果这些评论存在回复, 相关回复也会一并删除, 该操作不可撤销
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
              isDisabled={deleting}
            >
              {deleteProgress ? `删除中 ${deleteProgress}` : '删除'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
