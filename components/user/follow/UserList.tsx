'use client'

import { Avatar, Card, CardBody } from '@heroui/react'
import { Users } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { kunFetchGet } from '~/utils/kunFetch'
import { useRouter } from '@bprogress/next'
import { KunLoading } from '~/components/kun/Loading'
import { KunNull } from '~/components/kun/Null'
import { UserFollow } from './Follow'
import { KunPagination } from '~/components/kun/Pagination'
import type { UserFollow as UserFollowType } from '~/types/api/user'

interface UserListProps {
  userId: number
  type: 'followers' | 'following'
}

export const UserList = ({ userId, type }: UserListProps) => {
  const router = useRouter()

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(100)
  const [users, setUsers] = useState<UserFollowType[]>([])
  const [loading, startTransition] = useTransition()

  const getUsers = () => {
    startTransition(async () => {
      let results: UserFollowType[] = []
      let tt = 0

      if (type === 'followers') {
        const res = await kunFetchGet<{
          followers: UserFollowType[]
          total: number
        }>('/user/follow/follower', {
          uid: userId,
          page,
          limit: 100
        })
        results = res.followers
        tt = res.total
      } else {
        const res = await kunFetchGet<{
          followings: UserFollowType[]
          total: number
        }>('/user/follow/following', {
          uid: userId,
          page,
          limit: 100
        })
        results = res.followings
        tt = res.total
      }

      setUsers(results)
      setTotal(tt)
    })
  }

  useEffect(() => {
    getUsers()
  }, [page])

  return (
    <>
      {loading ? (
        <KunLoading hint="正在加载用户列表" />
      ) : (
        <div className="flex flex-col gap-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardBody className="flex flex-row items-center gap-4">
                <Avatar src={user.avatar} className="size-12" />
                <div className="space-y-2 grow">
                  <h4
                    className="text-lg font-semibold transition-colors cursor-pointer hover:text-primary-500"
                    onClick={() => router.push(`/user/${user.id}/resource`)}
                  >
                    {user.name}
                  </h4>
                  <p className="text-small text-default-500">{user.bio}</p>

                  <div className="flex items-center gap-2 text-sm text-default-500">
                    <Users className="size-4 text-default-400" />
                    {user.follower} 人关注 TA - {user.following} 正在关注
                  </div>
                </div>

                <UserFollow
                  uid={user.id}
                  name={user.name}
                  follow={user.isFollow}
                  fullWidth={false}
                />
              </CardBody>
            </Card>
          ))}

          {!users.length && (
            <KunNull
              message={
                type === 'followers'
                  ? '还没有人关注 TA 哦'
                  : 'TA 还没有关注过任何人哦'
              }
            />
          )}

          {total > 100 && (
            <div className="flex justify-center">
              <KunPagination
                total={Math.ceil(total / 100)}
                page={page}
                onPageChange={setPage}
                isLoading={loading}
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}
