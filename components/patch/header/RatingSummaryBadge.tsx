'use client'

import { useMemo } from 'react'
import {
  Chip,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent
} from '@heroui/react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer
} from 'recharts'
import {
  KUN_GALGAME_RATING_RECOMMEND_CONST,
  KUN_GALGAME_RATING_RECOMMEND_MAP
} from '~/constants/galgame'
import type { Patch } from '~/types/api/patch'
import { KunRating } from '~/components/kun/Rating'

interface Props {
  patch: Patch
}

export const PatchRatingSummaryBadge = ({ patch }: Props) => {
  const avg = patch.ratingSummary.average
  const count = patch.ratingSummary.count
  const histogram = patch.ratingSummary.histogram

  const chartData = useMemo(() => {
    const base = Array.from({ length: 10 }, (_, i) => ({
      score: i + 1,
      count: 0
    }))
    if (!histogram) {
      return base
    }

    const merged = [...base]
    for (const h of histogram) {
      if (h.score >= 1 && h.score <= 10) merged[h.score - 1].count = h.count
    }

    return merged
  }, [histogram])

  const rec = patch.ratingSummary.recommend || {
    strong_no: 0,
    no: 0,
    neutral: 0,
    yes: 0,
    strong_yes: 0
  }

  return (
    <div className="flex items-center gap-3">
      <KunRating readOnly valueMax={10} value={avg} />
      <span className="text-warning font-bold text-xl">{avg}</span>
      <span className="w-px h-4 bg-default-200" />

      <Popover placement="bottom-end" offset={8}>
        <PopoverTrigger>
          <div className="flex">
            <Tooltip content="点击查看统计分布图">
              <span className="cursor-pointer text-default-500 text-sm">
                查看评分分布
              </span>
            </Tooltip>
          </div>
        </PopoverTrigger>
        <PopoverContent className="p-4 w-[320px]">
          <div className="flex items-center gap-3 justify-between mb-2">
            <div className="text-base font-semibold">评分分布图</div>
            <div className="text-xs text-default-500">共 {count} 人评分</div>
          </div>
          <div className="w-full h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                className="[&_.recharts-surface]:outline-0 [&_.recharts-surface]:focus-visible:outline-2 [&_.recharts-surface]:focus-visible:outline-red"
                data={chartData}
                margin={{ left: 4, right: 4, top: 8 }}
              >
                <defs>
                  <linearGradient id="ratingBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--heroui-warning))" />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--heroui-warning) / 0.7)"
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="score"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  width={24}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11 }}
                />
                <RTooltip
                  formatter={(v: any) => [v, '人数']}
                  labelFormatter={(l) => `评分 ${l}`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--heroui-content1))',
                    border: '1px solid hsl(var(--heroui-border))',
                    borderRadius: '0.5rem',
                    color: 'hsl(var(--heroui-foreground))',
                    fontSize: '0.75rem'
                  }}
                  labelStyle={{
                    color: 'hsl(var(--heroui-foreground))',
                    fontWeight: 600
                  }}
                  cursor={{ fill: 'hsl(var(--heroui-default-200))' }}
                />
                <Bar
                  dataKey="count"
                  fill="url(#ratingBar)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {KUN_GALGAME_RATING_RECOMMEND_CONST.map((k) => {
              const color =
                k === 'strong_no'
                  ? 'danger'
                  : k === 'no'
                    ? 'warning'
                    : k === 'neutral'
                      ? 'default'
                      : k === 'yes'
                        ? 'success'
                        : 'secondary'
              return (
                <Chip key={k} size="sm" color={color as any} variant="flat">
                  {KUN_GALGAME_RATING_RECOMMEND_MAP[k]} {rec[k] ?? 0}
                </Chip>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
