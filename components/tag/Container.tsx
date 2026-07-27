'use client'

import { useEffect, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { TagHeader } from './TagHeader'
import { SearchTags } from './SearchTag'
import { TagList } from './TagList'
import { kunFetchGet, kunFetchPost } from '~/utils/kunFetch'
import { useMounted } from '~/hooks/useMounted'
import { KunPagination } from '~/components/kun/Pagination'
import { KunNull } from '~/components/kun/Null'
import type { Tag as TagType } from '~/types/api/tag'

interface Props {
  initialTags: TagType[]
  initialTotal: number
  uid?: number
}

export const Container = ({ initialTags, initialTotal, uid }: Props) => {
  const [tags, setTags] = useState<TagType[]>(initialTags)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const isMounted = useMounted()

  const fetchTags = async () => {
    if (!uid) {
      return
    }

    setLoading(true)
    const response = await kunFetchGet<
      KunResponse<{
        tags: TagType[]
        total: number
      }>
    >('/tag/all', {
      page,
      limit: 100
    })
    if (typeof response !== 'string') {
      setTags(response.tags)
      setTotal(response.total)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!isMounted || !uid) {
      return
    }
    fetchTags()
  }, [page])

  const [query, setQuery] = useState('')
  const [debouncedQuery] = useDebounce(query, 500)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!isMounted || !uid) {
      return
    }

    if (debouncedQuery) {
      handleSearch()
    } else {
      fetchTags()
    }
  }, [debouncedQuery])

  const handleSearch = async () => {
    if (!uid || !query.trim()) {
      return
    }

    setSearching(true)
    const response = await kunFetchPost<KunResponse<TagType[]>>('/tag/search', {
      query: query.split(' ').filter((term) => term.length > 0)
    })
    if (typeof response !== 'string') {
      setTags(response)
    }
    setSearching(false)
  }

  return (
    <div className="flex flex-col w-full my-4 space-y-8">
      <TagHeader setNewTag={(newTag) => setTags([newTag, ...initialTags])} />

      {uid ? (
        <>
          <SearchTags
            query={query}
            setQuery={setQuery}
            handleSearch={handleSearch}
            searching={searching}
          />

          {!searching && (
            <TagList tags={tags} loading={loading} searching={searching} />
          )}

          {total > 100 && !query && (
            <div className="flex justify-center">
              <KunPagination
                total={Math.ceil(total / 100)}
                page={page}
                onPageChange={setPage}
                isLoading={loading}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <KunNull message="请登录后查看游戏标签" />
        </>
      )}
    </div>
  )
}
