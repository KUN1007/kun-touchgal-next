'use client'

import { useEffect, useRef, useState } from 'react'
import { kunFetchGet } from '~/utils/kunFetch'
import { errorReporter, kunErrorHandler } from '~/utils/kunErrorHandler'
import { KunPagination } from '~/components/kun/Pagination'
import { KunNull } from '~/components/kun/Null'
import { KunLoading } from '~/components/kun/Loading'
import { UserRatingCard } from './Card'
import type { UserRating as UserRatingType } from '~/types/api/user'

interface Props {
  initRatings: UserRatingType[]
  total: number
  uid: number
}

export const UserRating = ({ initRatings, total, uid }: Props) => {
  const [ratings, setRatings] = useState<UserRatingType[]>(initRatings)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  // 陈旧响应守卫: 分页输入框在 loading 期间仍可跳页, 慢响应不得覆盖新页数据
  const latestFetchRequestIdRef = useRef(0)

  const fetchData = async () => {
    const requestId = latestFetchRequestIdRef.current + 1
    latestFetchRequestIdRef.current = requestId
    setLoading(true)
    try {
      const response = await kunFetchGet<
        KunResponse<{
          ratings: UserRatingType[]
          total: number
        }>
      >('/user/profile/rating', {
        uid,
        page,
        limit: 20
      })

      if (requestId !== latestFetchRequestIdRef.current) {
        return
      }
      kunErrorHandler(response, (value) => setRatings(value.ratings))
    } catch (error) {
      errorReporter(error)
    } finally {
      if (requestId === latestFetchRequestIdRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (page === 1) {
      // 作废在途请求, 防旧页响应覆盖 initRatings; 其 finally 被守卫跳过故须自清 loading
      latestFetchRequestIdRef.current += 1
      setRatings(initRatings)
      setLoading(false)
      return
    }
    fetchData()
  }, [initRatings, page, uid])

  return (
    <div className="space-y-4">
      {loading ? (
        <KunLoading hint="正在获取评价数据..." />
      ) : (
        <>
          {ratings.map((rating) => (
            <UserRatingCard key={rating.id} rating={rating} />
          ))}
        </>
      )}

      {!total && <KunNull message="这个孩子还没有发布过游戏评价哦" />}

      {total > 20 && (
        <div className="flex justify-center">
          <KunPagination
            total={Math.ceil(total / 20)}
            page={page}
            onPageChange={setPage}
            isLoading={loading}
          />
        </div>
      )}
    </div>
  )
}
