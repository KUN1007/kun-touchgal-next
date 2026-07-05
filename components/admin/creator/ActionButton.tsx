'use client'

import { useState } from 'react'
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
  useDisclosure
} from '@heroui/react'
import { kunFetchPut } from '~/utils/kunFetch'
import type { AdminCreator } from '~/types/api/admin'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import toast from 'react-hot-toast'

interface Props {
  creator: AdminCreator
  onUpdate: () => void
}

export const ActionButton = ({ creator, onUpdate }: Props) => {
  const [approving, setApproving] = useState(false)
  const {
    isOpen: isOpenApprove,
    onOpen: onOpenApprove,
    onClose: onCloseApprove
  } = useDisclosure()
  const handleApprove = async () => {
    setApproving(true)

    const res = await kunFetchPut<KunResponse<{}>>('/admin/creator/approve', {
      messageId: creator.id,
      uid: creator.sender?.id
    })
    kunErrorHandler(res, () => {
      toast.success('同意申请成功!')
      onCloseApprove()
      onUpdate()
    })
    setApproving(false)
  }

  const [reason, setReason] = useState('')
  const [declining, serDeclining] = useState(false)
  const {
    isOpen: isOpenDecline,
    onOpen: onOpenDecline,
    onClose: onCloseDecline
  } = useDisclosure()
  const handleDecline = async () => {
    serDeclining(true)

    const res = await kunFetchPut<KunResponse<{}>>('/admin/creator/decline', {
      messageId: creator.id,
      reason
    })
    kunErrorHandler(res, () => {
      toast.success('拒绝申请成功!')
      onCloseDecline()
      onUpdate()
    })
    serDeclining(false)
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" color="success" onPress={onOpenApprove}>
        同意该申请
      </Button>
      <Button size="sm" color="danger" onPress={onOpenDecline}>
        拒绝该申请
      </Button>

      <Modal isOpen={isOpenApprove} onClose={onCloseApprove}>
        <ModalContent>
          <ModalHeader>同意申请人</ModalHeader>
          <ModalBody>
            您确定要同意该申请吗, 这将会将该用户设置为创作者,
            并且开放该用户的上传资源权限
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCloseApprove}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={handleApprove}
              isDisabled={approving}
              isLoading={approving}
            >
              同意
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isOpenDecline} onClose={onCloseDecline}>
        <ModalContent>
          <ModalHeader>拒绝申请人</ModalHeader>
          <ModalBody>
            <Textarea
              label="请填写拒绝原因"
              placeholder="请提供拒绝原因以便申请人进行更改..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCloseDecline}>
              取消
            </Button>
            <Button
              color="danger"
              onPress={handleDecline}
              isDisabled={declining}
              isLoading={declining}
            >
              拒绝
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
