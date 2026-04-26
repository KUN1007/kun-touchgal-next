'use client'

import toast from 'react-hot-toast'
import { useEffect } from 'react'
import { NavbarContent, NavbarItem } from '@heroui/navbar'
import Link from 'next/link'
import { Button } from '@heroui/button'
import { Skeleton } from '@heroui/skeleton'
import { useUserStore } from '~/store/userStore'
import { useMessageStore } from '~/store/messageStore'
import { useRouter } from '@bprogress/next'
import { kunFetchGet } from '~/utils/kunFetch'
import { ThemeSwitcher } from './ThemeSwitcher'
import { useMounted } from '~/hooks/useMounted'
import { UserDropdown } from './UserDropdown'
import { KunSearch } from './Search'
import { UserMessageBell } from './UserMessageBell'
import { Tooltip } from '@heroui/tooltip'
import { RandomGalgameButton } from '~/components/home/carousel/RandomGalgameButton'
import type { UserSession } from '~/types/api/session'

export const KunTopBarUser = () => {
  const router = useRouter()
  const { user, setUser } = useUserStore((state) => state)
  const {
    hasUnreadNotification,
    hasUnreadConversation,
    setHasUnreadNotification,
    setUnreadMessageStatus
  } = useMessageStore((state) => state)
  const isMounted = useMounted()

  useEffect(() => {
    if (!isMounted) {
      return
    }
    if (!user.uid) {
      return
    }

    const getUserSession = async () => {
      const res = await kunFetchGet<KunResponse<UserSession>>('/user/session')
      if (typeof res === 'string') {
        toast.error(res)
        router.push('/login')
      } else {
        setUser(res.user)
        setUnreadMessageStatus(res.unread)
      }
    }

    getUserSession()
  }, [isMounted])

  const hasUnread = hasUnreadNotification || hasUnreadConversation

  return (
    <NavbarContent as="div" className="items-center" justify="end">
      {isMounted ? (
        <>
          {!user.name && (
            <NavbarContent justify="end">
              <NavbarItem className="hidden lg:flex">
                <Link href="/login">登录</Link>
              </NavbarItem>
              <NavbarItem>
                <Button
                  as={Link}
                  color="primary"
                  href="/register"
                  variant="flat"
                  className="hidden lg:flex"
                >
                  注册
                </Button>
              </NavbarItem>
              <NavbarItem className="flex lg:hidden">
                <Button as={Link} color="primary" href="/login" variant="flat">
                  登录
                </Button>
              </NavbarItem>
            </NavbarContent>
          )}

          <KunSearch />

          <Tooltip
            disableAnimation
            showArrow
            closeDelay={0}
            content="随机一部游戏"
          >
            <RandomGalgameButton isIconOnly variant="light" />
          </Tooltip>

          <ThemeSwitcher />

          {user.name && (
            <>
              <UserMessageBell
                hasUnreadMessages={hasUnread}
                setReadMessage={() => setHasUnreadNotification(false)}
              />

              <UserDropdown />
            </>
          )}
        </>
      ) : (
        <Skeleton className="rounded-lg">
          <div className="w-32 h-10 rounded-lg bg-default-300" />
        </Skeleton>
      )}
    </NavbarContent>
  )
}
