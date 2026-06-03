'use client'

import { useEffect, useState } from 'react'
import { User } from '@heroui/react'
import { kunFetchGet } from '~/utils/kunFetch'
import { KunUserStatCard } from './KunUserStatCard'
import { KunUserCardSkeleton } from './KunUserCardSkeleton'
import { UserFollow } from '~/components/user/follow/Follow'
import type { FloatingCardUser } from '~/types/api/user'

interface UserCardProps {
  uid: number
}

export const KunUserCard = ({ uid }: UserCardProps) => {
  const [user, setUser] = useState<FloatingCardUser | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const user = await kunFetchGet<FloatingCardUser>(
        '/user/profile/floating',
        { uid }
      )
      setUser(user)
    }
    fetchData()
  }, [])

  if (!user) {
    return <KunUserCardSkeleton />
  }

  return (
    <div className="p-2 w-[300px]">
      <div className="flex items-center justify-between">
        <User
          name={user.name}
          description={user.bio || '这只笨萝莉还没有签名'}
          avatarProps={{
            src: user.avatar,
            isBordered: true,
            color: 'secondary',
            className: 'w-12 h-12 shrink-0'
          }}
          className="mb-2"
        />

        <UserFollow
          uid={user.id}
          name={user.name}
          follow={user.isFollow}
          fullWidth={false}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <KunUserStatCard value={user._count.follower} label="关注者" />
        <KunUserStatCard value={user._count.patch} label="Galgame 数" />
        <KunUserStatCard value={user._count.patch_resource} label="资源数" />
      </div>
    </div>
  )
}

export default KunUserCard
