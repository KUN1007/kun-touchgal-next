'use client'

import { useEffect, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { TagHeader } from './TagHeader'
import { SearchTags } from './SearchTag'
import { TagList } from './TagList'
import { kunFetchGet, kunFetchPost } from '~/utils/kunFetch'
import { useMounted } from '~/hooks/useMounted'
import { KunPagination } from '~/components/kun/Pagination'
import type { Tag as TagType } from '~/types/api/tag'

interface Props {
  initialTags: TagType[]
  initialTotal: number
}

const PAGE_LIMIT = 100

export const Container = ({ initialTags, initialTotal }: Props) => {
  const [tags, setTags] = useState<TagType[]>(initialTags)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const isMounted = useMounted()

  const fetchTags = async () => {
    setLoading(true)
    const { tags, total } = await kunFetchGet<{
      tags: TagType[]
      total: number
    }>('/tag/all', {
      page,
      limit: PAGE_LIMIT
    })
    setTags(tags)
    setTotal(total)
    setLoading(false)
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchTags()
  }, [page])

  const [query, setQuery] = useState('')
  const [debouncedQuery] = useDebounce(query, 500)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (debouncedQuery) {
      handleSearch()
    } else {
      fetchTags()
    }
  }, [debouncedQuery])

  const handleSearch = async () => {
    if (!query.trim()) {
      return
    }

    setSearching(true)
    const response = await kunFetchPost<TagType[]>('/search/tag', {
      query: query.split(' ').filter((term) => term.length > 0)
    })
    setTags(response)
    setSearching(false)
  }

  return (
    <div className="flex flex-col w-full my-4 space-y-8">
      <TagHeader setNewTag={(newTag) => setTags([newTag, ...initialTags])} />

      <SearchTags
        query={query}
        setQuery={setQuery}
        handleSearch={handleSearch}
        searching={searching}
      />

      {!searching && (
        <TagList tags={tags} loading={loading} searching={searching} />
      )}

      {total > PAGE_LIMIT && !query && (
        <div className="flex justify-center">
          <KunPagination
            total={Math.ceil(total / PAGE_LIMIT)}
            page={page}
            onPageChange={setPage}
            isLoading={loading}
          />
        </div>
      )}
    </div>
  )
}
