'use client'

import { useEffect, useState } from 'react'
import { kunFetchGet } from '~/utils/kunFetch'
import { errorReporter, kunErrorHandler } from '~/utils/kunErrorHandler'
import { KunPagination } from '~/components/kun/Pagination'
import { KunNull } from '~/components/kun/Null'
import { KunLoading } from '~/components/kun/Loading'
import { UserCommentCard } from './Card'
import type { UserComment as UserCommentType } from '~/types/api/user'

interface Props {
  initComments: UserCommentType[]
  total: number
  uid: number
}

export const UserComment = ({ initComments, total, uid }: Props) => {
  const [comments, setComments] = useState<UserCommentType[]>(initComments)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await kunFetchGet<
        KunResponse<{
          comments: UserCommentType[]
          total: number
        }>
      >('/user/profile/comment', {
        uid,
        page,
        limit: 20
      })

      kunErrorHandler(response, (value) => setComments(value.comments))
    } catch (error) {
      errorReporter(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (page === 1) {
      setComments(initComments)
      return
    }
    fetchData()
  }, [initComments, page, uid])

  return (
    <div className="space-y-4">
      {loading ? (
        <KunLoading hint="正在获取评论数据..." />
      ) : (
        <>
          {comments.map((com) => (
            <UserCommentCard key={com.id} comment={com} />
          ))}
        </>
      )}

      {!total && <KunNull message="这个孩子还没有发布过评论哦" />}

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
