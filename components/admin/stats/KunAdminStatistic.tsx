'use client'

import { FC, useEffect, useState } from 'react'
import { Divider, Slider } from '@heroui/react'
import { useDebounce } from 'use-debounce'
import { KunAdminSum } from './KunAdminSum'
import { kunFetchGet } from '~/utils/kunFetch'
import { StatsCard } from './StatsCard'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { ADMIN_STATS_MAP } from '~/constants/admin'
import type { OverviewData } from '~/types/api/admin'

export const KunAdminStatistic: FC = () => {
  const [overview, setOverview] = useState<OverviewData>({
    newUser: 0,
    newActiveUser: 0,
    newGalgame: 0,
    newGalgameResource: 0,
    newComment: 0
  })
  const [days, setDays] = useState(1)
  const [debouncedDays] = useDebounce(days, 300)
  const [loading, setLoading] = useState(true)

  const fetchOverview = async (days: number) => {
    const res = await kunFetchGet<KunResponse<OverviewData>>('/admin/stats', {
      days
    })
    kunErrorHandler(res, setOverview)
    setLoading(false)
  }

  useEffect(() => {
    fetchOverview(debouncedDays)
  }, [debouncedDays])

  return (
    <div className="space-y-8">
      <KunAdminSum />

      <Divider />

      <div className="flex flex-col space-y-6">
        <h3 className="text-lg font-semibold whitespace-nowrap">{`${days} 天内数据统计`}</h3>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(ADMIN_STATS_MAP).map(([key, title]) => (
            <StatsCard
              key={key}
              title={title}
              value={overview[key as keyof OverviewData]}
              isLoading={loading}
            />
          ))}
        </div>

        <div className="flex-grow max-w-xl">
          <Slider
            label="设置天数"
            step={1}
            minValue={1}
            maxValue={60}
            value={days}
            getValue={(value) => `${value} 天`}
            onChange={(value) => setDays(Number(value))}
          />
        </div>
      </div>
    </div>
  )
}
