'use client'

import { Chip, Input, Select, SelectItem } from '@heroui/react'
import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { kunFetchGet } from '~/utils/kunFetch'
import { errorReporter } from '~/utils/kunErrorHandler'
import { kunShouldBackfillDeletedRow } from '~/utils/pagination'
import { useMounted } from '~/hooks/useMounted'
import { KunCardSkeleton } from '~/components/kun/CardSkeleton'
import { KunPagination } from '~/components/kun/Pagination'
import { AdminResourceApplyCard } from './Card'
import { ResourceApprovalButton } from './ApprovalButton'
import type { AdminResource } from '~/types/api/admin'
import type { PatchResource } from '~/types/api/patch'
import toast from 'react-hot-toast'

interface Props {
  initialResources: AdminResource[]
  initialTotal: number
}

export const ResourceApply = ({ initialResources, initialTotal }: Props) => {
  const [resources, setResources] = useState<AdminResource[]>(initialResources)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(30)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 500)
  const isMounted = useMounted()

  const [loading, setLoading] = useState(false)

  const latestFetchRequestIdRef = useRef(0)
  // 本渲染时刻的请求序号; 删行后补齐前比对, 若期间有过新请求 (翻页/筛选变更)
  // 则闭包参数已过期, 跳过静默补齐让用户请求的响应落地
  const renderFetchRequestId = latestFetchRequestIdRef.current

  const fetchData = async ({ silent = false } = {}) => {
    const requestId = latestFetchRequestIdRef.current + 1
    latestFetchRequestIdRef.current = requestId
    if (!silent) {
      setLoading(true)
    }
    try {
      const response = await kunFetchGet<
        KunResponse<{
          resources: AdminResource[]
          total: number
        }>
      >('/admin/resource-apply', {
        page,
        limit,
        search: debouncedQuery
      })
      if (requestId !== latestFetchRequestIdRef.current) {
        return
      }
      if (typeof response === 'string') {
        // 静默补齐失败不提示: 刚展示过操作成功的 toast, 紧跟报错只会误导
        if (!silent) {
          toast.error(response)
        }
        return
      }
      setResources(response.resources)
      setTotal(response.total)
    } catch (error) {
      if (silent || requestId !== latestFetchRequestIdRef.current) {
        return
      }
      errorReporter(error)
    } finally {
      if (requestId === latestFetchRequestIdRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }

    fetchData()
  }, [page, limit, debouncedQuery])

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    setPage(1)
  }

  const handleResourceUpdated = (updatedResource: PatchResource) => {
    setResources((prev) =>
      prev.map((resource) =>
        resource.id === updatedResource.id
          ? {
              ...resource,
              ...updatedResource
            }
          : resource
      )
    )
  }

  // 同意/拒绝后该资源不再处于待审核, 直接从列表移除
  const handleResourceResolved = (resourceId: number) => {
    if (resources.length === 1 && page > 1) {
      setPage(page - 1)
      return
    }
    setResources((prev) =>
      prev.filter((resource) => resource.id !== resourceId)
    )
    setTotal((prev) => Math.max(0, prev - 1))
    if (
      kunShouldBackfillDeletedRow(total, page, limit) &&
      latestFetchRequestIdRef.current === renderFetchRequestId
    ) {
      fetchData({ silent: true })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">资源首次发布申请</h1>
        <Chip variant="flat">仅展示等待审核的用户首次资源</Chip>
      </div>

      <Input
        fullWidth
        isClearable
        placeholder="输入资源链接（或 BLAKE3 Hash），按回车搜索待审核资源"
        startContent={<Search className="text-default-300" size={20} />}
        value={searchQuery}
        onValueChange={handleSearch}
      />

      {loading ? (
        <KunCardSkeleton count={3} />
      ) : (
        <div className="space-y-4">
          {resources.map((resource) => (
            <AdminResourceApplyCard
              key={resource.id}
              resource={resource}
              actions={
                <ResourceApprovalButton
                  resource={resource}
                  onResourceUpdated={handleResourceUpdated}
                  onResourceResolved={handleResourceResolved}
                />
              }
            />
          ))}
        </div>
      )}

      <div className="flex justify-center w-full">
        <KunPagination
          total={Math.ceil(total / limit)}
          onPageChange={setPage}
          isLoading={loading}
          page={page}
        />
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-default-500">
        <span>每页显示</span>
        <Select
          aria-label="每页显示数量"
          size="sm"
          className="w-20"
          selectedKeys={new Set([String(limit)])}
          onSelectionChange={(keys) => {
            const val = Number(Array.from(keys)[0])
            if (val && val !== limit) {
              setLimit(val)
              setPage(1)
            }
          }}
        >
          <SelectItem key="30">30</SelectItem>
          <SelectItem key="50">50</SelectItem>
          <SelectItem key="100">100</SelectItem>
          <SelectItem key="500">500</SelectItem>
        </Select>
        <span>条，共 {total} 条</span>
      </div>
    </div>
  )
}
