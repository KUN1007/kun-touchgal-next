'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  KUN_GALGAME_RATING_RECOMMEND_CONST,
  KUN_GALGAME_RATING_RECOMMEND_MAP
} from '~/constants/galgame'
import type { Patch } from '~/types/api/patch'
import { KunRating } from '~/components/kun/Rating'
import { KunLoading } from '~/components/kun/Loading'

const RatingDistributionChart = dynamic(
  () => import('./RatingDistributionChart'),
  {
    ssr: false,
    loading: () => <KunLoading hint="加载分布图" />
  }
)

const preloadRatingDistributionChart = () => {
  void import('./RatingDistributionChart')
}

type RatingHistogram = Patch['ratingSummary']['histogram']
type RecommendKey = keyof Patch['ratingSummary']['recommend']

const buildChartData = (histogram: RatingHistogram) => {
  const data = Array.from({ length: 10 }, (_, i) => ({
    score: i + 1,
    count: 0
  }))

  for (const item of histogram) {
    if (item.score >= 1 && item.score <= 10) {
      data[item.score - 1].count = item.count
    }
  }

  return data
}

const getRecommendClass = (key: RecommendKey) => {
  switch (key) {
    case 'strong_no':
      return 'bg-danger-100 text-danger-600'
    case 'no':
      return 'bg-warning-100 text-warning-600'
    case 'neutral':
      return 'bg-default-100 text-default-600'
    case 'yes':
      return 'bg-success-100 text-success-600'
    case 'strong_yes':
      return 'bg-secondary-100 text-secondary-600'
  }
}

interface Props {
  patch: Patch
}

export const PatchRatingSummaryBadge = ({ patch }: Props) => {
  const avg = patch.ratingSummary.average
  const count = patch.ratingSummary.count
  const histogram = patch.ratingSummary.histogram
  const rec = patch.ratingSummary.recommend || {
    strong_no: 0,
    no: 0,
    neutral: 0,
    yes: 0,
    strong_yes: 0
  }

  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const chartData = useMemo(
    () => (popoverOpen ? buildChartData(histogram) : null),
    [histogram, popoverOpen]
  )

  useEffect(() => {
    if (!popoverOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && popoverRef.current?.contains(target)) {
        return
      }
      setPopoverOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPopoverOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [popoverOpen])

  return (
    <div className="flex items-center gap-3">
      <KunRating readOnly valueMax={10} value={avg} />
      <span className="text-warning font-bold text-xl">{avg}</span>
      <span className="w-px h-4 bg-default-200" />

      <div ref={popoverRef} className="relative">
        <button
          type="button"
          className="text-default-500 text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-small"
          aria-expanded={popoverOpen}
          aria-controls={
            popoverOpen ? 'patch-rating-summary-popover' : undefined
          }
          onClick={() => setPopoverOpen((open) => !open)}
          onMouseEnter={preloadRatingDistributionChart}
          onFocus={preloadRatingDistributionChart}
        >
          查看评分分布
        </button>

        {popoverOpen && (
          <div
            id="patch-rating-summary-popover"
            role="dialog"
            className="fixed inset-x-4 top-24 z-50 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-large border border-divider bg-content1 p-4 text-content1-foreground shadow-large sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-none sm:w-[320px] sm:overflow-visible"
          >
            <div className="flex items-center gap-3 justify-between mb-2">
              <div className="text-base font-semibold">评分分布图</div>
              <div className="text-xs text-default-500">共 {count} 人评分</div>
            </div>
            <div className="w-full h-52">
              {chartData && <RatingDistributionChart data={chartData} />}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {KUN_GALGAME_RATING_RECOMMEND_CONST.map((key) => {
                const recommendKey = key as RecommendKey
                return (
                  <span
                    key={key}
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRecommendClass(recommendKey)}`}
                  >
                    {KUN_GALGAME_RATING_RECOMMEND_MAP[recommendKey]}{' '}
                    {rec[recommendKey] ?? 0}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
