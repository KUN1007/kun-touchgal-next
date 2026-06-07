'use client'

import { useState } from 'react'
import { cn } from '~/utils/cn'
import { KunTimeAgo } from '~/components/kun/TimeAgo'
import { KunAvatar } from '~/components/kun/floating-card/KunAvatar'
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem
} from '@heroui/dropdown'
import { Button } from '@heroui/react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from '@heroui/modal'
import { Textarea } from '@heroui/input'
import { Pencil, Trash2 } from 'lucide-react'
import { kunFetchPut, kunFetchDelete } from '~/utils/kunFetch'
import toast from 'react-hot-toast'
import type { PrivateMessage } from '~/types/api/conversation'

type MessageUpdateData =
  | { action: 'delete' }
  | { action: 'edit'; content: string; editedAt: string | Date }

interface Props {
  message: PrivateMessage
  isOwn: boolean
  conversationId: number
  onMessageUpdated: (data: MessageUpdateData) => void
}

export const ChatMessage = ({
  message,
  isOwn,
  conversationId,
  onMessageUpdated
}: Props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure()
  const [editContent, setEditContent] = useState(message.content)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleEdit = async () => {
    if (!editContent.trim()) {
      toast.error('消息内容不能为空')
      return
    }

    setIsSubmitting(true)
    const response = await kunFetchPut<
      KunResponse<{ id: number; content: string; editedAt: string }>
    >(`/message/conversation/${conversationId}`, {
      messageId: message.id,
      content: editContent.trim()
    })

    if (typeof response === 'string') {
      toast.error(response)
    } else {
      toast.success('消息已编辑')
      onClose()
      onMessageUpdated({
        action: 'edit',
        content: response.content,
        editedAt: response.editedAt
      })
    }
    setIsSubmitting(false)
  }

  const handleDelete = async () => {
    setIsSubmitting(true)
    const response = await kunFetchDelete<KunResponse<{}>>(
      `/message/conversation/${conversationId}`,
      { messageId: message.id }
    )

    if (typeof response === 'string') {
      toast.error(response)
    } else {
      toast.success('消息已删除')
      onMessageUpdated({ action: 'delete' })
    }
    setIsSubmitting(false)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isOwn && !message.isDeleted) {
      e.preventDefault()
      setIsMenuOpen(true)
    }
  }

  const handleClick = () => {
    if (isOwn && !message.isDeleted) {
      setIsMenuOpen(true)
    }
  }

  if (message.isDeleted) {
    return (
      <div
        className={cn(
          'flex gap-3 mb-4',
          isOwn ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        <KunAvatar
          uid={message.sender.id}
          avatarProps={{
            src: message.sender.avatar,
            name: message.sender.name,
            className: 'shrink-0'
          }}
        />
        <div className="max-w-[70%] rounded-2xl px-4 py-2 bg-default-100 dark:bg-default-200">
          <p className="text-sm text-default-400 italic">
            {message.sender.name} 删除了一条消息
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          'flex gap-3 mb-4',
          isOwn ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        <KunAvatar
          uid={message.sender.id}
          avatarProps={{
            src: message.sender.avatar,
            name: message.sender.name,
            className: 'shrink-0'
          }}
        />

        {isOwn ? (
          <Dropdown isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownTrigger>
              <div
                className="max-w-[70%] rounded-2xl px-4 py-2 cursor-pointer bg-primary-500 text-white"
                onContextMenu={handleContextMenu}
                onClick={handleClick}
              >
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </p>
                <div className="text-xs mt-1 flex items-center gap-2 text-primary-100">
                  <span>
                    <KunTimeAgo date={message.created} />
                  </span>
                  {message.editedAt && <span>(已编辑)</span>}
                </div>
              </div>
            </DropdownTrigger>
            <DropdownMenu aria-label="消息操作">
              <DropdownItem
                key="edit"
                startContent={<Pencil className="size-4" />}
                onPress={() => {
                  setEditContent(message.content)
                  onOpen()
                }}
              >
                编辑
              </DropdownItem>
              <DropdownItem
                key="delete"
                className="text-danger"
                color="danger"
                startContent={<Trash2 className="size-4" />}
                onPress={handleDelete}
              >
                删除
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        ) : (
          <div className="max-w-[70%] rounded-2xl px-4 py-2 bg-default-100 dark:bg-default-200">
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
            <div className="text-xs mt-1 flex items-center gap-2 text-default-400">
              <span>
                <KunTimeAgo date={message.created} />
              </span>
              {message.editedAt && <span>(已编辑)</span>}
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="top">
        <ModalContent>
          <ModalHeader>编辑消息</ModalHeader>
          <ModalBody>
            <Textarea
              value={editContent}
              onValueChange={setEditContent}
              minRows={2}
              maxRows={10}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              取消
            </Button>
            <Button
              color="primary"
              isLoading={isSubmitting}
              onPress={handleEdit}
            >
              保存
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
