'use client'

import { Input, Button, Card, CardBody } from '@heroui/react'
import { Select, SelectItem } from '@heroui/select'
import { ArrowUpDown } from 'lucide-react'
import type { RankingSortField } from '~/types/api/ranking'

const SORT_OPTIONS: Array<{
  value: RankingSortField
  label: string
}> = [
  { value: 'rating', label: '平均评分' },
  { value: 'rating_count', label: '评分人数' },
  { value: 'like', label: '点赞数' },
  { value: 'favorite', label: '收藏数' },
  { value: 'resource', label: '资源数' },
  { value: 'comment', label: '评论数' },
  { value: 'view', label: '浏览数' },
  { value: 'download', label: '下载数' }
]

type SortOrder = 'asc' | 'desc'

interface Props {
  sortField: RankingSortField
  sortOrder: SortOrder
  minRatingCount: number
  isLoading: boolean
  onSortFieldChange: (value: RankingSortField) => void
  onSortOrderChange: (value: SortOrder) => void
  onMinRatingCountChange: (value: number) => void
}

export const RankingControls = ({
  sortField,
  sortOrder,
  minRatingCount,
  isLoading,
  onSortFieldChange,
  onSortOrderChange,
  onMinRatingCountChange
}: Props) => {
  const handleMinCountChange = (value: string) => {
    const parsed = Number(value)
    if (Number.isNaN(parsed)) return
    onMinRatingCountChange(Math.max(0, parsed))
  }

  return (
    <Card>
      <CardBody>
        <div className="flex gap-3">
          <Select
            label="排序字段"
            labelPlacement="outside"
            selectedKeys={[sortField]}
            onChange={(event) => {
              if (!event.target.value) {
                return
              }
              onSortFieldChange(event.target.value as RankingSortField)
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value}>{option.label}</SelectItem>
            ))}
          </Select>

          <Input
            type="number"
            label="最低评分人数"
            labelPlacement="outside"
            value={String(minRatingCount)}
            min={0}
            onValueChange={handleMinCountChange}
            isDisabled={isLoading}
          />

          <Button
            variant="flat"
            color="primary"
            className="shrink-0 mt-auto"
            startContent={<ArrowUpDown className="size-4" />}
            onPress={() =>
              onSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc')
            }
            isDisabled={isLoading}
          >
            {sortOrder === 'desc' ? '从高到低' : '从低到高'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
