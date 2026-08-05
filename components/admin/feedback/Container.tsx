'use client'

import { useEffect, useState } from 'react'
import { Select, SelectItem } from '@heroui/react'
import { kunFetchGet } from '~/utils/kunFetch'
import { KunCardSkeleton } from '~/components/kun/CardSkeleton'
import { useMounted } from '~/hooks/useMounted'
import { FeedbackCard } from './FeedbackCard'
import { KunPagination } from '~/components/kun/Pagination'
import type { AdminFeedback } from '~/types/api/admin'

interface Props {
  initialFeedbacks: AdminFeedback[]
  total: number
}

export const Feedback = ({ initialFeedbacks, total: initialTotal }: Props) => {
  const [feedbacks, setFeedbacks] = useState<AdminFeedback[]>(initialFeedbacks)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(30)
  const isMounted = useMounted()

  const [loading, setLoading] = useState(false)
  const fetchData = async () => {
    setLoading(true)

    const res = await kunFetchGet<{
      feedbacks: AdminFeedback[]
      total: number
    }>('/admin/feedback', {
      page,
      limit
    })

    setLoading(false)
    setFeedbacks(res.feedbacks)
    setTotal(res.total)
  }

  // 处理成功后就地把该条标记为已处理, 不整表刷新
  const handleFeedbackHandled = (feedbackId: number) => {
    setFeedbacks((prev) =>
      prev.map((feedback) =>
        feedback.id === feedbackId ? { ...feedback, status: 1 } : feedback
      )
    )
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchData()
  }, [page, limit])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gal 反馈管理</h1>

      <div className="space-y-4">
        {loading ? (
          <KunCardSkeleton count={3} />
        ) : (
          <>
            {feedbacks.map((feedback) => (
              <FeedbackCard
                key={feedback.id}
                feedback={feedback}
                onHandled={handleFeedbackHandled}
              />
            ))}
          </>
        )}
      </div>

      <div className="flex justify-center">
        <KunPagination
          total={Math.ceil(total / limit)}
          page={page}
          onPageChange={setPage}
          isLoading={loading}
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
