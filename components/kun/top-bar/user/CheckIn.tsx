'use client'

import { useShallow } from 'zustand/react/shallow'
import { DropdownItem } from '@heroui/dropdown'
import { CalendarCheck, Sparkles } from 'lucide-react'
import { useUserStore } from '~/store/userStore'
import { useState } from 'react'
import { kunFetchPost } from '~/utils/kunFetch'
import { showKunSooner } from '~/components/kun/Sooner'
import { kunErrorHandler } from '~/utils/kunErrorHandler'

export const UserCheckIn = () => {
  const { user, setUser } = useUserStore(
    useShallow((state) => ({ user: state.user, setUser: state.setUser }))
  )

  const [checking, setChecking] = useState(false)
  const handleCheckIn = async () => {
    if (checking) {
      return
    }

    setChecking(true)
    const res = await kunFetchPost<
      KunResponse<{
        randomMoemoepoints: number
      }>
    >('/user/status/check-in')
    kunErrorHandler(res, (value) => {
      showKunSooner(
        value
          ? `签到成功! 您今天获得了 ${value.randomMoemoepoints} 萌萌点`
          : '您的运气不好...今天没有获得萌萌点...'
      )
      setUser({
        ...user,
        dailyCheckIn: 1,
        moemoepoint: user.moemoepoint + value.randomMoemoepoints
      })
    })
    setChecking(false)
  }

  return (
    <DropdownItem
      key="check"
      textValue="今日签到"
      color="secondary"
      startContent={<CalendarCheck className="size-4" />}
      endContent={
        user.dailyCheckIn ? (
          <span className="text-xs">签到过啦</span>
        ) : (
          <Sparkles className="size-5 text-secondary-500" />
        )
      }
      onPress={handleCheckIn}
    >
      今日签到
    </DropdownItem>
  )
}
