'use client'

import { FC, useEffect, useState } from 'react'
import { StatsCard } from './StatsCard'
import { kunFetchGet } from '~/utils/kunFetch'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { ADMIN_STATS_SUM_MAP } from '~/constants/admin'
import type { SumData } from '~/types/api/admin'

export const KunAdminSum: FC = () => {
  const [sum, setSum] = useState<SumData>({
    userCount: 0,
    galgameCount: 0,
    galgameResourceCount: 0,
    galgamePatchResourceCount: 0,
    galgameCommentCount: 0
  })
  const [loading, setLoading] = useState(true)

  const fetchSummaryData = async () => {
    const res = await kunFetchGet<KunResponse<SumData>>('/admin/stats/sum')
    kunErrorHandler(res, setSum)
    setLoading(false)
  }

  useEffect(() => {
    fetchSummaryData()
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">数据统计</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(ADMIN_STATS_SUM_MAP).map(([key, title]) => (
          <StatsCard
            key={key}
            title={title}
            value={sum[key as keyof SumData]}
            isLoading={loading}
          />
        ))}
      </div>
    </div>
  )
}
