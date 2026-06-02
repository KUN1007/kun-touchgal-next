'use client'

import { useShallow } from 'zustand/react/shallow'
import { Card, CardBody, CardFooter, CardHeader } from '@heroui/card'
import { Input } from '@heroui/input'
import { Button } from '@heroui/button'
import { useUserStore } from '~/store/userStore'
import { useState } from 'react'
import { kunFetchPost } from '~/utils/kunFetch'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { usernameSchema } from '~/validations/user'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@heroui/modal'
import toast from 'react-hot-toast'

export const Username = () => {
  const { user, setUser } = useUserStore(
    useShallow((state) => ({ user: state.user, setUser: state.setUser }))
  )
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { isOpen, onOpen, onOpenChange } = useDisclosure()

  const handleSave = async () => {
    if (user.moemoepoint < 30) {
      toast.error('更改用户名最少需要 30 萌萌点, 您的萌萌点不足')
      return
    }

    const result = usernameSchema.safeParse({ username })
    if (!result.success) {
      setError(result.error.errors[0].message)
    } else {
      setError('')

      setLoading(true)

      const res = await kunFetchPost<KunResponse<{}>>(
        '/user/setting/username',
        { username }
      )
      kunErrorHandler(res, () => {
        toast.success('更新用户名成功')
        setUser({ ...user, name: username, moemoepoint: user.moemoepoint - 30 })
        setUsername('')
      })
      setLoading(false)
    }
  }

  return (
    <Card className="w-full text-sm">
      <CardHeader>
        <h2 className="text-xl font-medium">用户名</h2>
      </CardHeader>
      <CardBody className="py-0 space-y-4">
        <div>
          <p>这是您的用户名设置, 您的用户名是唯一的</p>
        </div>
        <Input
          label="用户名"
          autoComplete="text"
          defaultValue={user.name}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          isInvalid={!!error}
          errorMessage={error}
        />
      </CardBody>

      <CardFooter className="flex-wrap">
        <p className="text-default-500">
          用户名长度最大为 17, 可以是任意字符, 更改用户名需要消耗您 30 萌萌点
        </p>

        <Button
          color="primary"
          variant="solid"
          className="ml-auto"
          onPress={onOpen}
        >
          保存
        </Button>

        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  您确定要更改用户名吗?
                </ModalHeader>
                <ModalBody>
                  <p>更改用户名需要消耗您 30 萌萌点, 该操作不可撤销</p>
                </ModalBody>
                <ModalFooter>
                  <Button color="danger" variant="light" onPress={onClose}>
                    关闭
                  </Button>
                  <Button
                    color="primary"
                    onPress={() => {
                      handleSave()
                      onClose()
                    }}
                    isLoading={loading}
                    disabled={loading}
                  >
                    确定
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </CardFooter>
    </Card>
  )
}
