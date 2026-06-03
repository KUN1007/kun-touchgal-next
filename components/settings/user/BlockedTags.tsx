'use client'

import { useShallow } from 'zustand/react/shallow'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDebounce } from 'use-debounce'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Chip } from '@heroui/chip'
import { Input } from '@heroui/input'
import { Listbox, ListboxItem } from '@heroui/listbox'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { kunFetchDelete, kunFetchGet, kunFetchPost } from '~/utils/kunFetch'
import { useUserStore } from '~/store/userStore'
import type { Tag } from '~/types/api/tag'

interface UpdateBlockedTagResponse {
  blockedTagIds: number[]
}

interface DropdownRect {
  top: number
  left: number
  width: number
}

interface BlockedTagsProps {
  isActive?: boolean
}

export const BlockedTags = ({ isActive = true }: BlockedTagsProps) => {
  const { user, setUser } = useUserStore(
    useShallow((state) => ({ user: state.user, setUser: state.setUser }))
  )
  const [blockedTags, setBlockedTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState(0)

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)
  const [searchResults, setSearchResults] = useState<Tag[]>([])
  const [searching, setSearching] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<DropdownRect | null>(null)

  const inputWrapperRef = useRef<HTMLDivElement>(null)

  const syncBlockedTags = async () => {
    if (!user.uid) {
      return
    }
    setLoading(true)
    try {
      const response = await kunFetchGet<KunResponse<Tag[]>>(
        '/user/setting/blocked-tag'
      )
      if (typeof response === 'string') {
        toast.error(response)
      } else {
        setBlockedTags(response)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    syncBlockedTags()
  }, [user.uid])

  const updateDropdownRect = () => {
    if (!inputWrapperRef.current) return
    const rect = inputWrapperRef.current.getBoundingClientRect()
    setDropdownRect({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width
    })
  }

  useEffect(() => {
    if (!isActive) {
      setDropdownOpen(false)
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive) {
      setDropdownOpen(false)
      return
    }
    if (!debouncedQuery.trim()) {
      setSearchResults([])
      setDropdownOpen(false)
      return
    }
    const query = debouncedQuery
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 10)
    setSearching(true)
    updateDropdownRect()
    setDropdownOpen(true)
    kunFetchPost<KunResponse<Tag[]>>('/tag/search', { query })
      .then((res) => {
        if (typeof res === 'string') {
          toast.error(res)
        } else {
          setSearchResults(res)
        }
      })
      .finally(() => setSearching(false))
  }, [debouncedQuery, isActive])

  useEffect(() => {
    if (!dropdownOpen) return

    const handleScroll = () => updateDropdownRect()
    const handleResize = () => updateDropdownRect()
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [dropdownOpen])

  useEffect(() => {
    if (!dropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputWrapperRef.current &&
        !inputWrapperRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const handleBlockTag = async (tag: Tag) => {
    if (!user.uid || updatingId) return

    setUpdatingId(tag.id)
    try {
      const response = await kunFetchPost<
        KunResponse<UpdateBlockedTagResponse>
      >('/user/setting/blocked-tag', { tagId: tag.id })
      if (typeof response === 'string') {
        toast.error(response)
        return
      }

      setUser({ ...user, blockedTagIds: response.blockedTagIds })
      setBlockedTags((prev) => [...prev, tag])
      setSearchQuery('')
      setSearchResults([])
      setDropdownOpen(false)
      toast.success(`已屏蔽标签「${tag.name}」`)
    } finally {
      setUpdatingId(0)
    }
  }

  const handleUnblockTag = async (tag: Tag) => {
    if (!user.uid || updatingId) return

    setUpdatingId(tag.id)
    try {
      const response = await kunFetchDelete<
        KunResponse<UpdateBlockedTagResponse>
      >('/user/setting/blocked-tag', { tagId: tag.id })
      if (typeof response === 'string') {
        toast.error(response)
        return
      }

      setUser({ ...user, blockedTagIds: response.blockedTagIds })
      setBlockedTags((prev) => prev.filter((item) => item.id !== tag.id))
      toast.success(`已取消屏蔽标签「${tag.name}」`)
    } finally {
      setUpdatingId(0)
    }
  }

  const filteredResults = searchResults.filter(
    (tag) => !user.blockedTagIds.includes(tag.id)
  )

  const dropdown =
    dropdownOpen && dropdownRect
      ? createPortal(
          <div
            style={{
              position: 'absolute',
              top: dropdownRect.top + 4,
              left: dropdownRect.left,
              width: dropdownRect.width,
              zIndex: 9999
            }}
            className="rounded-medium border border-default-200 bg-content1 shadow-medium dark:border-default-100"
          >
            {searching ? (
              <p className="px-3 py-2 text-xs text-default-400">正在搜索...</p>
            ) : filteredResults.length ? (
              <Listbox
                aria-label="标签搜索结果"
                classNames={{
                  list: 'max-h-60 overflow-y-auto scrollbar-hide'
                }}
                onAction={(key) => {
                  const tag = filteredResults.find((t) => String(t.id) === key)
                  if (tag) handleBlockTag(tag)
                }}
              >
                {filteredResults.map((tag) => (
                  <ListboxItem
                    key={String(tag.id)}
                    textValue={tag.name}
                    isDisabled={!!updatingId}
                    endContent={
                      <span className="text-xs text-default-400">
                        {tag.count} 个游戏
                      </span>
                    }
                  >
                    {tag.name}
                  </ListboxItem>
                ))}
              </Listbox>
            ) : (
              <p className="px-3 py-2 text-xs text-default-400">
                未找到可添加的相关标签
              </p>
            )}
          </div>,
          document.body
        )
      : null

  return (
    <Card className="w-full text-sm">
      <CardHeader>
        <h2 className="text-xl font-medium">标签屏蔽</h2>
      </CardHeader>

      <CardBody className="space-y-4 py-0 pb-4">
        <p>屏蔽某个标签后，带有该标签的游戏将不会出现在公开列表中。</p>

        <div className="space-y-2">
          <p className="text-default-500">已屏蔽标签</p>
          <div ref={inputWrapperRef}>
            <Input
              value={searchQuery}
              onValueChange={(v) => {
                setSearchQuery(v)
                if (v.trim()) {
                  updateDropdownRect()
                  setDropdownOpen(true)
                } else {
                  setDropdownOpen(false)
                }
              }}
              onFocus={() => {
                if (searchQuery.trim() && filteredResults.length) {
                  updateDropdownRect()
                  setDropdownOpen(true)
                }
              }}
              placeholder="搜索标签名称"
              startContent={<Search className="size-4 text-default-400" />}
              isClearable
              onClear={() => {
                setSearchQuery('')
                setSearchResults([])
                setDropdownOpen(false)
              }}
            />
          </div>
          {dropdown}
        </div>

        <div className="space-y-2">
          {loading ? (
            <p className="text-default-500">正在加载已屏蔽标签...</p>
          ) : blockedTags.length ? (
            <div className="flex flex-wrap gap-2">
              {blockedTags.map((tag) => (
                <Chip
                  key={tag.id}
                  color="danger"
                  variant="flat"
                  isDisabled={!!updatingId}
                  onClose={() => handleUnblockTag(tag)}
                >
                  {tag.name}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-default-500">您暂时没有屏蔽任何标签</p>
          )}
        </div>

        <p className="text-default-400">
          点按搜索结果中的标签可将其加入屏蔽名单，点按已屏蔽标签可取消屏蔽。
        </p>
      </CardBody>
    </Card>
  )
}
