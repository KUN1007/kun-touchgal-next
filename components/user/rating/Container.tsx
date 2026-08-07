'use client'

import { useEffect, useState } from 'react'
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

  const fetchData = async () => {
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

      kunErrorHandler(response, (value) => setRatings(value.ratings))
    } catch (error) {
      errorReporter(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (page === 1) {
      setRatings(initRatings)
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
