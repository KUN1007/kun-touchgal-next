'use client'

import { useState } from 'react'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger
} from '@heroui/dropdown'
import { Button } from '@heroui/button'
import { Card, CardHeader, CardBody } from '@heroui/card'
import { Select, SelectItem } from '@heroui/select'
import { Input } from '@heroui/react'
import { Divider } from '@heroui/divider'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  ChevronDown,
  ChevronUp,
  Filter
} from 'lucide-react'
import {
  ALL_SUPPORTED_LANGUAGE,
  ALL_SUPPORTED_PLATFORM,
  ALL_SUPPORTED_TYPE,
  SUPPORTED_LANGUAGE_MAP,
  SUPPORTED_PLATFORM_MAP,
  SUPPORTED_TYPE_MAP
} from '~/constants/resource'
import type { SortField, SortOrder } from './_sort'

interface Props {
  selectedType: string
  setSelectedType: (types: string) => void
  sortField: SortField
  setSortField: (option: SortField) => void
  sortOrder: SortOrder
  setSortOrder: (direction: SortOrder) => void
  selectedLanguage: string
  setSelectedLanguage: (language: string) => void
  selectedPlatform: string
  setSelectedPlatform: (platform: string) => void
  selectedYears: string[]
  setSelectedYears: (years: string[]) => void
  selectedMonths: string[]
  setSelectedMonths: (months: string[]) => void
  minRatingCount?: number
  setMinRatingCount?: (count: number) => void
}

const sortFieldLabelMap: Record<string, string> = {
  resource_update_time: '资源更新时间',
  created: '游戏创建时间',
  rating: '评分',
  view: '浏览量',
  download: '下载量',
  favorite: '收藏量'
}

const currentYear = new Date().getFullYear()
const GALGAME_SORT_YEARS = [
  'all',
  'future',
  'unknown',
  ...Array.from({ length: currentYear - 1979 }, (_, i) =>
    String(currentYear - i)
  )
]

const GALGAME_SORT_YEARS_MAP: Record<string, string> = {
  all: '全部年份',
  future: '未发售',
  unknown: '未知年份'
}

const GALGAME_SORT_MONTHS = [
  'all',
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12'
]

export const FilterBar = ({
  selectedType,
  setSelectedType,
  sortField,
  setSortField,
  sortOrder,
  setSortOrder,
  selectedLanguage,
  setSelectedLanguage,
  selectedPlatform,
  setSelectedPlatform,
  selectedYears,
  setSelectedYears,
  selectedMonths,
  setSelectedMonths,
  minRatingCount,
  setMinRatingCount
}: Props) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const currentSortLabel =
    sortFieldLabelMap[sortField] ?? (sortField === 'rating' ? '评分' : '排序')

  const ratingFilterActive = sortField === 'rating' && minRatingCount !== 10

  const hasActiveFilters =
    selectedType !== 'all' ||
    selectedLanguage !== 'all' ||
    selectedPlatform !== 'all' ||
    !selectedYears.includes('all') ||
    !selectedMonths.includes('all') ||
    ratingFilterActive

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between gap-3 w-full">
          <div className="flex gap-3">
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="flat"
                  className="w-full justify-between text-sm"
                  endContent={<ChevronDown className="size-4" />}
                >
                  {currentSortLabel}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="排序选项"
                selectedKeys={new Set([sortField])}
                onAction={(key) => setSortField(key as SortField)}
                selectionMode="single"
                className="min-w-[200px]"
              >
                <DropdownItem
                  key="resource_update_time"
                  className="text-default-700"
                >
                  资源更新时间
                </DropdownItem>
                <DropdownItem key="created" className="text-default-700">
                  游戏创建时间
                </DropdownItem>
                <DropdownItem key="rating" className="text-default-700">
                  评分
                </DropdownItem>
                <DropdownItem key="view" className="text-default-700">
                  浏览量
                </DropdownItem>
                <DropdownItem key="download" className="text-default-700">
                  下载量
                </DropdownItem>
                <DropdownItem key="favorite" className="text-default-700">
                  收藏量
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>

            <Button
              variant="flat"
              className="text-sm shrink-0"
              onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              startContent={
                sortOrder === 'asc' ? (
                  <ArrowUpAZ className="size-4" />
                ) : (
                  <ArrowDownAZ className="size-4" />
                )
              }
            >
              <span className="sm:hidden">
                {sortOrder === 'asc' ? '升序' : '降序'}
              </span>
              <span className="hidden sm:inline">
                {sortOrder === 'asc' ? '升序' : '降序'}
              </span>
            </Button>
          </div>

          <Button
            variant={showAdvancedFilters ? 'solid' : 'flat'}
            className="sm:w-auto text-sm"
            onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
            endContent={
              showAdvancedFilters ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )
            }
            color={hasActiveFilters ? 'primary' : 'default'}
          >
            高级筛选
          </Button>
        </div>
      </CardHeader>

      {showAdvancedFilters && (
        <>
          <Divider />
          <CardBody className="pt-3">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Select
                  label="类型筛选"
                  placeholder="选择类型"
                  selectedKeys={[selectedType]}
                  onChange={(event) => {
                    if (!event.target.value) {
                      return
                    }
                    setSelectedType(event.target.value)
                  }}
                  startContent={<Filter className="size-4 text-default-400" />}
                  radius="lg"
                  size="sm"
                >
                  {ALL_SUPPORTED_TYPE.map((type) => (
                    <SelectItem key={type} className="text-default-700">
                      {SUPPORTED_TYPE_MAP[type]}
                    </SelectItem>
                  ))}
                </Select>

                <Select
                  label="语言筛选"
                  placeholder="选择语言"
                  selectedKeys={[selectedLanguage]}
                  onChange={(event) => {
                    if (!event.target.value) {
                      return
                    }
                    setSelectedLanguage(event.target.value)
                  }}
                  startContent={<Filter className="size-4 text-default-400" />}
                  radius="lg"
                  size="sm"
                >
                  {ALL_SUPPORTED_LANGUAGE.map((language) => (
                    <SelectItem key={language} className="text-default-700">
                      {SUPPORTED_LANGUAGE_MAP[language]}
                    </SelectItem>
                  ))}
                </Select>

                <Select
                  label="平台筛选"
                  placeholder="选择平台"
                  selectedKeys={[selectedPlatform]}
                  onChange={(event) => {
                    if (!event.target.value) {
                      return
                    }
                    setSelectedPlatform(event.target.value)
                  }}
                  startContent={<Filter className="size-4 text-default-400" />}
                  radius="lg"
                  size="sm"
                >
                  {ALL_SUPPORTED_PLATFORM.map((platform) => (
                    <SelectItem key={platform} className="text-default-700">
                      {SUPPORTED_PLATFORM_MAP[platform]}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-3">
                <Select
                  disallowEmptySelection
                  label="发售年份"
                  placeholder="选择年份"
                  selectedKeys={selectedYears}
                  disabledKeys={['future']}
                  onSelectionChange={(keys) => {
                    if (keys.anchorKey === 'all') {
                      setSelectedYears(['all'])
                      setSelectedMonths(['all'])
                    } else {
                      setSelectedYears(
                        Array.from(keys as Set<string>).filter(
                          (item) => item !== 'all'
                        )
                      )
                    }
                  }}
                  startContent={
                    <Calendar className="size-4 text-default-400" />
                  }
                  selectionMode="multiple"
                  radius="lg"
                  size="sm"
                >
                  {GALGAME_SORT_YEARS.map((year) => (
                    <SelectItem key={year} className="text-default-700">
                      {GALGAME_SORT_YEARS_MAP[year] ?? year}
                    </SelectItem>
                  ))}
                </Select>

                <Select
                  disallowEmptySelection
                  label="发售月份"
                  placeholder="选择月份"
                  selectedKeys={selectedMonths}
                  onSelectionChange={(keys) => {
                    if (keys.anchorKey === 'all') {
                      setSelectedMonths(['all'])
                    } else {
                      setSelectedMonths(
                        Array.from(keys as Set<string>).filter(
                          (item) => item !== 'all'
                        )
                      )
                    }
                  }}
                  startContent={
                    <Calendar className="size-4 text-default-400" />
                  }
                  selectionMode="multiple"
                  radius="lg"
                  size="sm"
                  isDisabled={
                    selectedYears.includes('all') ||
                    selectedYears.includes('future')
                  }
                >
                  {GALGAME_SORT_MONTHS.map((month) => (
                    <SelectItem key={month} className="text-default-700">
                      {month === 'all' ? '全部月份' : month}
                    </SelectItem>
                  ))}
                </Select>

                {setMinRatingCount && (
                  <Input
                    type="number"
                    label="最低评分人数（仅评分排序生效）"
                    placeholder="10"
                    size="sm"
                    value={String(minRatingCount)}
                    min={0}
                    onValueChange={(value) => {
                      const parsed = Number(value)
                      if (Number.isNaN(parsed)) {
                        return
                      }
                      setMinRatingCount(Math.max(0, parsed))
                    }}
                    isDisabled={sortField !== 'rating'}
                  />
                )}

                <Button
                  radius="lg"
                  size="lg"
                  variant="flat"
                  className="text-sm ml-auto"
                  onPress={() => {
                    setSelectedType('all')
                    setSelectedLanguage('all')
                    setSelectedPlatform('all')
                    setSelectedYears(['all'])
                    setSelectedMonths(['all'])
                    setMinRatingCount?.(10)
                  }}
                >
                  重置筛选
                </Button>
              </div>
            </div>
          </CardBody>
        </>
      )}
    </Card>
  )
}
