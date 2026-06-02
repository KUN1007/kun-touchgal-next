'use client'

import { DropdownItem } from '@heroui/dropdown'
import { Button } from '@heroui/button'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@heroui/modal'
import { LogOut } from 'lucide-react'
import { useUserStore } from '~/store/userStore'
import { useState } from 'react'
import { useRouter } from '@bprogress/next'
import { kunFetchPost } from '~/utils/kunFetch'
import toast from 'react-hot-toast'

export const UserDropdown = () => {
  const router = useRouter()
  const logout = useUserStore((state) => state.logout)
  const [loading, setLoading] = useState(false)
  const { isOpen, onOpen, onOpenChange } = useDisclosure()

  const handleLogOut = async () => {
    setLoading(true)
    await kunFetchPost<KunResponse<{}>>('/user/status/logout')
    setLoading(false)
    logout()
    router.push('/login')
    toast.success('您已经成功登出!')
  }

  return (
    <>
      <DropdownItem
        key="logout"
        color="danger"
        startContent={<LogOut className="size-4" />}
        onPress={onOpen}
      >
        退出登录
      </DropdownItem>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                您确定要登出网站吗?
              </ModalHeader>
              <ModalBody>
                <p>
                  登出将会清除您的登录状态, 但是不会清除您的编辑草稿 (Galgame,
                  回复等), 您可以稍后继续登录
                </p>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  关闭
                </Button>
                <Button
                  color="primary"
                  onPress={() => {
                    handleLogOut()
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
    </>
  )
}
