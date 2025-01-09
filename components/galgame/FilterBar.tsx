'use client'

import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger
} from '@nextui-org/dropdown'
import { Button } from '@nextui-org/button'
import { Card, CardHeader } from '@nextui-org/card'
import { Select, SelectItem } from '@nextui-org/select'
import { ArrowDownAZ, ArrowUpAZ, ChevronDown, Filter } from 'lucide-react'
import { ALL_SUPPORTED_TYPE, SUPPORTED_TYPE_MAP } from '~/constants/resource'
import type { SortDirection, SortOption } from './_sort'

interface Props {
  selectedType: string
  setSelectedType: (types: string) => void
  sortField: SortOption
  setSortField: (option: SortOption) => void
  sortOrder: SortDirection
  setSortOrder: (direction: SortDirection) => void
}

const sortFieldLabelMap: Record<string, string> = {
  created: '创建时间',
  view: '浏览量',
  download: '下载量'
}

export const FilterBar = ({
  selectedType,
  setSelectedType,
  sortField,
  setSortField,
  sortOrder,
  setSortOrder
}: Props) => {
  return (
    <Card className="w-full border border-content2 bg-content1/50 backdrop-blur-lg">
      <CardHeader>
        <div className="flex flex-col w-full gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Select
            label="类型筛选"
            placeholder="选择类型"
            selectedKeys={[selectedType]}
            className="max-w-xs"
            onChange={(event) => setSelectedType(event.target.value)}
            startContent={<Filter className="size-4 text-default-400" />}
            classNames={{
              trigger: 'bg-content2/50 hover:bg-content2 transition-colors',
              value: 'text-default-700',
              label: 'text-default-600'
            }}
            radius="lg"
            size="sm"
          >
            {ALL_SUPPORTED_TYPE.map((type) => (
              <SelectItem key={type} value={type} className="text-default-700">
                {SUPPORTED_TYPE_MAP[type]}
              </SelectItem>
            ))}
          </Select>

          <div className="flex items-center gap-2">
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="flat"
                  className="transition-colors bg-content2/50 hover:bg-content2"
                  endContent={<ChevronDown className="size-4" />}
                  radius="lg"
                >
                  {sortFieldLabelMap[sortField]}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="排序选项"
                selectedKeys={new Set([sortField])}
                onAction={(key) => setSortField(key as SortOption)}
                selectionMode="single"
                className="min-w-[120px]"
              >
                <DropdownItem key="created" className="text-default-700">
                  创建时间
                </DropdownItem>
                <DropdownItem key="view" className="text-default-700">
                  浏览量
                </DropdownItem>
                <DropdownItem key="download" className="text-default-700">
                  下载量
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>

            <Button
              variant="flat"
              className="transition-colors bg-content2/50 hover:bg-content2"
              onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              startContent={
                sortOrder === 'asc' ? (
                  <ArrowUpAZ className="size-4" />
                ) : (
                  <ArrowDownAZ className="size-4" />
                )
              }
              radius="lg"
            >
              {sortOrder === 'asc' ? '升序' : '降序'}
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
