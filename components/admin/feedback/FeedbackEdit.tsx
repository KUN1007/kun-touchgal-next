'use client'

import { useState } from 'react'
import { Button } from '@nextui-org/button'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger
} from '@nextui-org/dropdown'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@nextui-org/modal'
import { Textarea } from '@nextui-org/input'
import { MoreVertical } from 'lucide-react'
import { useUserStore } from '~/store/providers/user'
import { kunFetchDelete, kunFetchPut } from '~/utils/kunFetch'
import type { AdminFeedback } from '~/types/api/admin'
import toast from 'react-hot-toast'

interface Props {
  initialFeedback: AdminFeedback
}

export const FeedbackEdit = ({ initialFeedback }: Props) => {
  const currentUser = useUserStore((state) => state.user)

  const {
    isOpen: isOpenDelete,
    onOpen: onOpenDelete,
    onClose: onCloseDelete
  } = useDisclosure()
  const [deleting, setDeleting] = useState(false)
  const handleDeleteFeedback = async () => {
    setDeleting(true)
    const res = await kunFetchDelete<KunResponse<{}>>('/admin/Feedback', {
      FeedbackId: initialFeedback.id
    })
    if (typeof res === 'string') {
      toast.error(res)
    } else {
      onCloseDelete()
      toast.success('评论删除成功')
    }
  }

  const {
    isOpen: isOpenEdit,
    onOpen: onOpenEdit,
    onClose: onCloseEdit
  } = useDisclosure()
  const [editContent, setEditContent] = useState('')
  const [updating, setUpdating] = useState(false)
  const handleUpdateFeedback = async () => {
    if (!editContent.trim()) {
      toast.error('评论内容不可为空')
      return
    }
    setUpdating(true)
    const res = await kunFetchPut<KunResponse<AdminFeedback>>(
      '/admin/Feedback',
      {
        FeedbackId: initialFeedback.id,
        content: editContent.trim()
      }
    )
    if (typeof res === 'string') {
      toast.error(res)
    } else {
      onCloseEdit()
      setEditContent('')
      toast.success('更新评论成功!')
    }
    setUpdating(false)
  }

  return (
    <>
      <Dropdown>
        <DropdownTrigger>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            isDisabled={currentUser.role < 3}
          >
            <MoreVertical size={16} />
          </Button>
        </DropdownTrigger>
        <DropdownMenu>
          <DropdownItem
            onPress={() => {
              setEditContent(initialFeedback.content)
              onOpenEdit()
            }}
          >
            编辑
          </DropdownItem>
          <DropdownItem
            className="text-danger"
            color="danger"
            onPress={onOpenDelete}
          >
            删除
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>

      <Modal isOpen={isOpenEdit} onClose={onCloseEdit} placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">编辑评论</ModalHeader>
          <ModalBody>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              minRows={2}
              maxRows={8}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => {
                setEditContent('')
                onCloseEdit()
              }}
            >
              取消
            </Button>
            <Button
              color="danger"
              onPress={handleUpdateFeedback}
              disabled={updating}
              isLoading={updating}
            >
              确定
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isOpenDelete} onClose={onCloseDelete} placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">删除评论</ModalHeader>
          <ModalBody>
            <p>
              您确定要删除这条评论吗, 这将会删除该评论,
              以及所有回复该评论的评论, 该操作不可撤销
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCloseDelete}>
              取消
            </Button>
            <Button
              color="danger"
              onPress={handleDeleteFeedback}
              disabled={deleting}
              isLoading={deleting}
            >
              删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
