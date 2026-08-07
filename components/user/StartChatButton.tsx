'use client'

import { useState } from 'react'
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from '@heroui/react'
import { MessageSquare } from 'lucide-react'
import { kunFetchGet, kunFetchPost } from '~/utils/kunFetch'
import { errorReporter } from '~/utils/kunErrorHandler'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface Props {
  targetUserId: number
}

interface CheckResponse {
  exists?: boolean
  conversationId?: number
  needsPayment?: boolean
  cost?: number
  currentPoints?: number
  targetUserName?: string
  error?: string
}

export const StartChatButton = ({ targetUserId }: Props) => {
  const [loading, setLoading] = useState(false)
  const [checkResult, setCheckResult] = useState<CheckResponse | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const router = useRouter()

  const handleStartChat = async () => {
    setLoading(true)
    try {
      const checkResponse = await kunFetchGet<CheckResponse>(
        '/message/conversation/check',
        { targetUserId }
      )

      if (typeof checkResponse === 'string') {
        toast.error(checkResponse)
        setLoading(false)
        return
      }

      if (checkResponse.error) {
        toast.error(checkResponse.error)
        setLoading(false)
        return
      }

      if (checkResponse.exists) {
        router.push(`/message/chat/${checkResponse.conversationId}`)
        return
      }

      setCheckResult(checkResponse)
      setLoading(false)
      onOpen()
    } catch (error) {
      errorReporter(error)
      setLoading(false)
    }
  }

  const handleConfirmCreate = async () => {
    setLoading(true)
    onClose()

    try {
      const response = await kunFetchPost<
        KunResponse<{ conversationId: number; isNew: boolean }>
      >('/message/conversation', { targetUserId })

      if (typeof response === 'string') {
        toast.error(response)
        setLoading(false)
        return
      }

      if (response.isNew && checkResult?.needsPayment) {
        toast.success(`已创建新会话，消耗 ${checkResult.cost} 萌萌点`)
      } else if (response.isNew) {
        toast.success('已创建新会话')
      }

      router.push(`/message/chat/${response.conversationId}`)
    } catch (error) {
      errorReporter(error)
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        startContent={<MessageSquare className="size-4" />}
        color="default"
        variant="flat"
        fullWidth
        isLoading={loading}
        onPress={handleStartChat}
      >
        私聊
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} placement="center">
        <ModalContent>
          <ModalHeader>发起私聊</ModalHeader>
          <ModalBody>
            {checkResult?.needsPayment ? (
              <div className="space-y-3">
                <p>
                  您即将与{' '}
                  <span className="font-bold">
                    {checkResult.targetUserName}
                  </span>{' '}
                  发起私聊。
                </p>
                <div className="p-3 rounded-lg bg-warning-50 dark:bg-warning-100/10 border border-warning-200 dark:border-warning-500/20">
                  <p className="text-warning-600 dark:text-warning-500 font-medium">
                    开启新会话将消耗{' '}
                    <span className="text-lg font-bold">
                      {checkResult.cost}
                    </span>{' '}
                    萌萌点
                  </p>
                </div>
                <p className="text-default-500 text-sm">
                  您当前的萌萌点：
                  <span className="font-medium">
                    {checkResult.currentPoints}
                  </span>
                </p>
              </div>
            ) : (
              <p>
                您即将与{' '}
                <span className="font-bold">{checkResult?.targetUserName}</span>{' '}
                发起私聊。
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={handleConfirmCreate}
              isLoading={loading}
            >
              确认
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
