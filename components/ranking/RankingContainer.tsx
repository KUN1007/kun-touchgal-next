'use client'

import { useEffect, useState } from 'react'
import { KunHeader } from '~/components/kun/Header'
import { KunPagination } from '~/components/kun/Pagination'
import { RankingControls } from './RankingControls'
import { RankingList } from './RankingList'
import { useMounted } from '~/hooks/useMounted'
import { kunFetchGet } from '~/utils/kunFetch'
import type { RankingCard, RankingSortField } from '~/types/api/ranking'

type SortOrder = 'asc' | 'desc'

interface Props {
  initialGalgames: RankingCard[]
  initialTotal: number
  initialSortField: RankingSortField
  initialSortOrder: SortOrder
  initialMinRatingCount: number
  pageSize?: number
}

const DEFAULT_PAGE_SIZE = 48

export const RankingContainer = ({
  initialGalgames,
  initialTotal,
  initialSortField,
  initialSortOrder,
  initialMinRatingCount,
  pageSize = DEFAULT_PAGE_SIZE
}: Props) => {
  const isMounted = useMounted()

  const [galgames, setGalgames] = useState<RankingCard[]>(initialGalgames)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [sortField, setSortField] = useState<RankingSortField>(initialSortField)
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder)
  const [minRatingCount, setMinRatingCount] = useState<number>(
    initialMinRatingCount
  )
  const [page, setPage] = useState(1)

  const fetchRanking = async () => {
    setLoading(true)

    const res = await kunFetchGet<{
      galgames: RankingCard[]
      total: number
    }>('/ranking', {
      sortField,
      sortOrder,
      minRatingCount,
      page,
      limit: pageSize
    })
    setGalgames(res.galgames)
    setTotal(res.total)

    setLoading(false)
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchRanking()
  }, [page])

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchRanking()
    setPage(1)
  }, [sortField, sortOrder, minRatingCount])

  return (
    <div className="container mx-auto my-4 space-y-6">
      <KunHeader
        name="Galgame 排行榜"
        description="Galgame 排行, 综合评分与下载数等数据, 为所有玩家提供参考"
      />

      <RankingControls
        sortField={sortField}
        sortOrder={sortOrder}
        minRatingCount={minRatingCount}
        isLoading={loading}
        onSortFieldChange={setSortField}
        onSortOrderChange={setSortOrder}
        onMinRatingCountChange={setMinRatingCount}
      />

      <RankingList galgames={galgames} page={page} pageSize={pageSize} />

      {total > DEFAULT_PAGE_SIZE && (
        <div className="flex justify-center">
          <KunPagination
            total={Math.ceil(total / DEFAULT_PAGE_SIZE)}
            page={page}
            onPageChange={setPage}
            isLoading={loading}
          />
        </div>
      )}
    </div>
  )
}
