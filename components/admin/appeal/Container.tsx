'use client'

import { Select, SelectItem } from '@heroui/react'
import { useEffect, useState, type Key } from 'react'
import { kunFetchGet } from '~/utils/kunFetch'
import { KunCardSkeleton } from '~/components/kun/CardSkeleton'
import { KunPagination } from '~/components/kun/Pagination'
import { useMounted } from '~/hooks/useMounted'
import { AppealCard } from './Card'
import { APPEAL_STATUS_MAP } from '~/constants/appeal'
import type { AdminAppealItem } from '~/types/api/appeal'

const statusFilterOptions = [
  { key: 'all', label: '全部' },
  ...Object.entries(APPEAL_STATUS_MAP).map(([key, label]) => ({
    key,
    label
  }))
]

interface Props {
  initialAppeals: AdminAppealItem[]
  initialTotal: number
}

export const Appeal = ({ initialAppeals, initialTotal }: Props) => {
  const [appeals, setAppeals] = useState<AdminAppealItem[]>(initialAppeals)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(false)
  const limit = 30
  const isMounted = useMounted()

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await kunFetchGet<{
        appeals: AdminAppealItem[]
        total: number
      }>('/admin/appeal', { page, limit, status })
      setAppeals(response.appeals)
      setTotal(response.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchData()
  }, [page, status])

  const handleStatusChange = (keys: 'all' | Set<Key>) => {
    const key = Array.from(keys)[0] as string | undefined
    if (!key) {
      return
    }
    setStatus(key)
    setPage(1)
  }

  if (!isMounted) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">申诉管理</h1>
        <KunCardSkeleton count={3} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">申诉管理</h1>

      <p className="text-sm text-default-500">
        用户对被 AI
        审核拒绝并隐藏的内容提交的申诉。通过申诉将应用用户修改后的内容并恢复展示；拒绝申诉将直接删除该内容（不可恢复）。
      </p>

      <Select
        aria-label="申诉状态筛选"
        className="w-full sm:max-w-40"
        selectedKeys={new Set([status])}
        onSelectionChange={handleStatusChange}
      >
        {statusFilterOptions.map((option) => (
          <SelectItem key={option.key}>{option.label}</SelectItem>
        ))}
      </Select>

      <div className="space-y-4">
        {loading ? (
          <KunCardSkeleton count={3} />
        ) : appeals.length ? (
          appeals.map((appeal) => (
            <AppealCard key={appeal.id} appeal={appeal} onRefresh={fetchData} />
          ))
        ) : (
          <div className="space-y-1 py-12 text-center">
            <p className="text-default-600">暂无申诉</p>
            <p className="text-sm text-default-500">
              用户对处罚的申诉会在这里排队, 可切换上方状态筛选查看历史记录
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <KunPagination
          total={Math.max(1, Math.ceil(total / limit))}
          page={page}
          onPageChange={setPage}
          isLoading={loading}
        />
      </div>
    </div>
  )
}
