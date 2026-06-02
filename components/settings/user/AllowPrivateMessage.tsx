'use client'

import { useShallow } from 'zustand/react/shallow'
import { Card, CardBody, CardFooter, CardHeader } from '@heroui/card'
import { useUserStore } from '~/store/userStore'
import { kunFetchPost } from '~/utils/kunFetch'
import toast from 'react-hot-toast'
import { Switch } from '@heroui/react'

export const AllowPrivateMessage = () => {
  const { user, setUser } = useUserStore(
    useShallow((state) => ({ user: state.user, setUser: state.setUser }))
  )

  const handleToggleAllowPrivateMessage = async (value: boolean) => {
    if (!user.uid) {
      toast.error('请先登录以使用此功能')
      return
    }

    const res = await kunFetchPost<KunResponse<{}>>(
      `/user/setting/allow-private-message`
    )
    if (typeof res !== 'string') {
      setUser({ ...user, allowPrivateMessage: value })
      toast.success(value ? '已允许接收私信' : '已关闭接收私信')
    }
  }

  return (
    <Card className="w-full text-sm">
      <CardHeader>
        <h2 className="text-xl font-medium">私信设置</h2>
      </CardHeader>
      <CardBody className="py-0 space-y-4">
        <div>
          <p>控制其他用户是否可以向您发送私信</p>
        </div>
        <div className="flex items-center justify-between">
          <p>是否允许接收私信</p>
          <Switch
            size="lg"
            color="primary"
            isSelected={user.allowPrivateMessage}
            onValueChange={handleToggleAllowPrivateMessage}
          />
        </div>
      </CardBody>

      <CardFooter className="flex-wrap">
        <p className="text-default-500">
          关闭后, 其他用户将无法向您发起新的私信会话
        </p>
      </CardFooter>
    </Card>
  )
}
