'use client'

import { useEffect, useState } from 'react'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { kunFetchGet } from '~/utils/kunFetch'
import { KunLoading } from '~/components/kun/Loading'
import { KunPagination } from '~/components/kun/Pagination'
import { useMounted } from '~/hooks/useMounted'
import { AppealCard } from './AppealCard'
import type { UserAppealItem } from '~/types/api/appeal'

export const AppealSettings = () => {
  const [appeals, setAppeals] = useState<UserAppealItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const limit = 10
  const isMounted = useMounted()

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await kunFetchGet<
        KunResponse<{ appeals: UserAppealItem[]; total: number }>
      >('/user/appeal', { page, limit })
      if (typeof response !== 'string') {
        setAppeals(response.appeals)
        setTotal(response.total)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchData()
  }, [isMounted, page])

  return (
    <Card className="w-full overflow-hidden rounded-[22px] border border-default-200/60 bg-background text-sm shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:bg-content1 dark:shadow-[0_12px_32px_rgba(0,0,0,0.15)]">
      <CardHeader className="flex-col items-start gap-1 px-5 pb-0 pt-5">
        <h2 className="text-xl font-semibold text-foreground">内容申诉</h2>
        <p className="max-w-2xl leading-6 text-default-500">
          未通过内容审核而被隐藏的评论、评价与资源会显示在这里。您可以修改内容后提交申诉，由管理员人工复核；申诉通过后内容将恢复展示，申诉被拒绝后内容将被删除。
        </p>
      </CardHeader>
      <CardBody className="space-y-4 overflow-visible px-5 py-4">
        {!isMounted || loading ? (
          <KunLoading hint="正在获取申诉记录..." />
        ) : appeals.length ? (
          appeals.map((item) => (
            <AppealCard key={item.taskId} item={item} onRefresh={fetchData} />
          ))
        ) : (
          <div className="py-12 text-center text-default-500">
            暂无被拒的内容
          </div>
        )}

        {total > limit && (
          <div className="flex justify-center">
            <KunPagination
              total={Math.max(1, Math.ceil(total / limit))}
              page={page}
              onPageChange={setPage}
              isLoading={loading}
            />
          </div>
        )}
      </CardBody>
    </Card>
  )
}
