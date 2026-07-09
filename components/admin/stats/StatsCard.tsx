'use client'

import { Card, CardBody } from '@heroui/react'
import type { FC } from 'react'

export const StatsCard: FC<{
  title: string
  value: number
  isLoading?: boolean
}> = ({ title, value, isLoading }) => (
  <Card className="w-full">
    <CardBody className="flex flex-col justify-between">
      <p className="text-sm font-medium tracking-wide text-default-500">
        {title}
      </p>
      {isLoading ? (
        <div
          className="mt-1 h-6 w-16 animate-pulse rounded-lg bg-default-200 motion-reduce:animate-none"
          role="status"
          aria-label="加载中"
        />
      ) : (
        <p className="text-xl font-semibold text-default-700">
          {value.toLocaleString('zh-CN')}
        </p>
      )}
    </CardBody>
  </Card>
)
