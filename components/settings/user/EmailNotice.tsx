'use client'

import { useShallow } from 'zustand/react/shallow'
import { Card, CardBody, CardFooter, CardHeader } from '@heroui/card'
import { useUserStore } from '~/store/userStore'
import { kunFetchPost } from '~/utils/kunFetch'
import toast from 'react-hot-toast'
import { Switch } from '@heroui/react'

export const EmailNotice = () => {
  const { user, setUser } = useUserStore(
    useShallow((state) => ({ user: state.user, setUser: state.setUser }))
  )

  const handleToggleEmailNotice = async (value: boolean) => {
    if (!user.uid) {
      toast.error('请先登录以使用此功能')
      return
    }

    const res = await kunFetchPost<KunResponse<{}>>(
      `/user/setting/email-notice`
    )
    if (typeof res !== 'string') {
      setUser({ ...user, enableEmailNotice: value })
      toast.success(value ? '开启邮件通知成功' : '关闭邮件通知成功')
    }
  }

  return (
    <Card className="w-full text-sm">
      <CardHeader>
        <h2 className="text-xl font-medium">邮件通知</h2>
      </CardHeader>
      <CardBody className="overflow-visible py-0 space-y-4">
        <div>
          <p>当网站有通知时, 会通过邮件的形式提醒您</p>
        </div>
        <div className="flex items-center justify-between">
          <p>是否开启邮件通知</p>
          <Switch
            size="lg"
            color="primary"
            isSelected={user.enableEmailNotice}
            onValueChange={handleToggleEmailNotice}
          />
        </div>
      </CardBody>

      <CardFooter className="flex-wrap">
        <p className="text-default-500">
          您可以开启或关闭邮件通知, 关闭后您将不会收到关于网站的任何邮件
        </p>
      </CardFooter>
    </Card>
  )
}
