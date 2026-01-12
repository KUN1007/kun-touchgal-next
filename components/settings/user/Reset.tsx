'use client'

import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@heroui/react'
import { Button } from '@heroui/button'
import { useRouter } from '@bprogress/next'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { kunFetchPost } from '~/utils/kunFetch'

export const Reset = () => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleResetData = async () => {
    localStorage.clear()
    onClose()

    setLoading(true)
    await kunFetchPost<KunResponse<{}>>('/user/status/logout')
    setLoading(false)

    router.push('/login')
    toast.success('您已成功清除网站所有数据, 请重新登录')

    await new Promise((resolve) => {
      setTimeout(resolve, 3000)
    })
    location.reload()
  }

  return (
    <Card className="w-full text-sm">
      <CardHeader>
        <h2 className="text-xl font-medium">清除网站数据</h2>
      </CardHeader>
      <CardBody className="py-0 space-y-4">
        <div>
          <p>
            如果您的网站出现任何报错, 例如搜索页面报错,
            可以尝试清除网站所有数据。清除网站数据需要重新登录,
            清除操作不会对您的账户信息产生任何影响
          </p>
        </div>
      </CardBody>

      <CardFooter className="flex-wrap">
        <p className="text-danger-500">注意, 清除操作无法撤销</p>

        <Button
          color="danger"
          variant="solid"
          className="ml-auto"
          onPress={onOpen}
          isLoading={loading}
        >
          清除
        </Button>
      </CardFooter>

      <Modal isOpen={isOpen} onClose={onClose} placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            您确定要清除网站所有数据吗
          </ModalHeader>
          <ModalBody>
            <p>
              清除网站数据将会清除您当前设备所有的网站缓存数据,
              并且需要重新登录, 清除操作不会对您的账户信息产生任何影响
            </p>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={onClose}>
              关闭
            </Button>
            <Button
              isLoading={loading}
              color="primary"
              onPress={handleResetData}
            >
              确定
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  )
}
