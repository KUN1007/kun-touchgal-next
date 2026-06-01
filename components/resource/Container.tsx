'use client'

import { useEffect, useRef, useState } from 'react'
import { kunFetchGet } from '~/utils/kunFetch'
import { ResourceCard } from './ResourceCard'
import { FilterBar } from './FilterBar'
import { KunLoading } from '~/components/kun/Loading'
import { KunHeader } from '../kun/Header'
import { useSearchParams } from 'next/navigation'
import { KunPagination } from '~/components/kun/Pagination'
import type { SortDirection, SortOption } from './_sort'
import type { PatchResource } from '~/types/api/resource'

interface Props {
  initialResources: PatchResource[]
  initialTotal: number
}

export const CardContainer = ({ initialResources, initialTotal }: Props) => {
  const didSkipInitialFetch = useRef(false)
  const [resources, setResources] = useState<PatchResource[]>(initialResources)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [sortField, setSortField] = useState<SortOption>('created')
  const [sortOrder, setSortOrder] = useState<SortDirection>('desc')
  const searchParams = useSearchParams()
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)

  const fetchData = async () => {
    setLoading(true)

    const { resources, total: nextTotal } = await kunFetchGet<{
      resources: PatchResource[]
      total: number
    }>('/resource', {
      sortField,
      sortOrder,
      page,
      limit: 50
    })

    setResources(resources)
    setTotal(nextTotal)
    setLoading(false)
  }

  useEffect(() => {
    if (!didSkipInitialFetch.current) {
      didSkipInitialFetch.current = true
      return
    }

    fetchData()
  }, [sortField, sortOrder, page])

  return (
    <div className="container mx-auto my-4 space-y-6">
      <KunHeader
        name="Galgame 补丁资源"
        description="这里展示了所有的 Galgame 补丁资源列表"
      />

      <FilterBar
        sortField={sortField}
        setSortField={setSortField}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />
      {loading ? (
        <KunLoading hint="正在获取补丁资源数据..." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-6 md:grid-cols-2">
          {resources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}

      {total > 50 && (
        <div className="flex justify-center">
          <KunPagination
            total={Math.ceil(total / 50)}
            page={page}
            onPageChange={setPage}
            isLoading={loading}
          />
        </div>
      )}
    </div>
  )
}
