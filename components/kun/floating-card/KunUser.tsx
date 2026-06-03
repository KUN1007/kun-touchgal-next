'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Tooltip } from '@heroui/tooltip'
import { User } from '@heroui/user'
import { useRouter } from '@bprogress/next'
import { KunUserCardSkeleton } from './KunUserCardSkeleton'
import type { UserProps } from '@heroui/user'

const KunUserCard = dynamic(() => import('./KunUserCard'), {
  ssr: false,
  loading: () => <KunUserCardSkeleton />
})

const preloadKunUserCard = () => {
  void import('./KunUserCard')
}

interface KunUserProps {
  user: KunUser
  userProps: UserProps
}

export const KunUser = ({ user, userProps }: KunUserProps) => {
  const router = useRouter()
  const [isCardRequested, setIsCardRequested] = useState(false)

  const { avatarProps, ...restUser } = userProps
  const { alt, name, ...restAvatar } = avatarProps!
  const username = name?.charAt(0).toUpperCase() ?? '杂鱼'
  const altString = alt ? alt : username

  return (
    <Tooltip
      showArrow
      delay={500}
      closeDelay={200}
      content={isCardRequested ? <KunUserCard uid={user.id} /> : null}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          setIsCardRequested(true)
        }
      }}
      classNames={{
        content: ['bg-background/70 backdrop-blur-md']
      }}
    >
      <User
        {...restUser}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          router.push(`/user/${user.id}/comment`)
        }}
        onMouseEnter={preloadKunUserCard}
        onFocus={preloadKunUserCard}
        avatarProps={{
          name: username,
          alt: altString,
          className:
            'transition-transform duration-200 cursor-pointer shrink-0 hover:scale-110',
          ...restAvatar
        }}
        className="cursor-pointer"
      />
    </Tooltip>
  )
}
