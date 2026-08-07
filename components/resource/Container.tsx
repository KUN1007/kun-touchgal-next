'use client'

import { useEffect, useRef, useState } from 'react'
import { kunFetchGet } from '~/utils/kunFetch'
import { errorReporter, kunErrorHandler } from '~/utils/kunErrorHandler'
import { ResourceCard } from './ResourceCard'
import { FilterBar } from './FilterBar'
import { KunLoading } from '~/components/kun/Loading'
import { KunHeader } from '../kun/Header'
import { useSearchParams } from 'next/navigation'
import { KunPagination } from '~/components/kun/Pagination'
import { KunNull } from '~/components/kun/Null'
import {
  kunShouldResetOverflowPage,
  parsePositiveIntParam
} from '~/utils/galgameFilter'
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
  const latestFetchRequestIdRef = useRef(0)
  const [sortField, setSortField] = useState<SortOption>('created')
  const [sortOrder, setSortOrder] = useState<SortDirection>('desc')
  const searchParams = useSearchParams()
  const [page, setPage] = useState(
    parsePositiveIntParam(searchParams.get('page'), 1)
  )
  const withPageReset = <T,>(setter: (value: T) => void) => {
    return (value: T) => {
      setPage(1)
      setter(value)
    }
  }

  const fetchData = async () => {
    const requestId = latestFetchRequestIdRef.current + 1
    latestFetchRequestIdRef.current = requestId
    setLoading(true)

    try {
      const response = await kunFetchGet<
        | {
            resources: PatchResource[]
            total: number
          }
        | string
      >('/resource', {
        sortField,
        sortOrder,
        page,
        limit: 50
      })

      if (requestId !== latestFetchRequestIdRef.current) {
        return
      }

      if (typeof response === 'string') {
        kunErrorHandler(response, () => {})
        setResources([])
        setTotal(0)
        return
      }

      if (
        kunShouldResetOverflowPage(
          response.total,
          response.resources.length,
          page
        )
      ) {
        setPage(1)
        return
      }

      setResources(response.resources)
      setTotal(response.total)
    } catch (error) {
      if (requestId !== latestFetchRequestIdRef.current) {
        return
      }
      setResources([])
      setTotal(0)
      errorReporter(error)
    } finally {
      if (requestId === latestFetchRequestIdRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!didSkipInitialFetch.current) {
      didSkipInitialFetch.current = true
      // 首屏用 SSR 数据不 fetch, 直达 overflow URL 时借 setPage 触发本 effect 重跑
      if (kunShouldResetOverflowPage(total, resources.length, page)) {
        setPage(1)
      }
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
        setSortField={withPageReset(setSortField)}
        sortOrder={sortOrder}
        setSortOrder={withPageReset(setSortOrder)}
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

      {!loading && !total && (
        <KunNull message="暂无补丁资源, 或您未开启网站 NSFW" />
      )}
    </div>
  )
}
