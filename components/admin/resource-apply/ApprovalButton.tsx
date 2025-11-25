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
import toast from 'react-hot-toast'
import { kunFetchPut } from '~/utils/kunFetch'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import type { AdminResource } from '~/types/api/admin'

interface Props {
  resource: AdminResource
}

export const ResourceApprovalButton = ({ resource }: Props) => {
  const [approving, setApproving] = useState(false)
  const {
    isOpen: isOpenApprove,
    onOpen: onOpenApprove,
    onClose: onCloseApprove
  } = useDisclosure()

  const handleApprove = async () => {
    setApproving(true)

    const res = await kunFetchPut<KunResponse<{}>>(
      '/admin/resource-apply/approve',
      {
        resourceId: resource.id
      }
    )
    kunErrorHandler(res, () => {
      toast.success('已通过该资源的发布申请')
      onCloseApprove()
    })
    setApproving(false)
  }

  const [reason, setReason] = useState('')
  const [declining, setDeclining] = useState(false)
  const {
    isOpen: isOpenDecline,
    onOpen: onOpenDecline,
    onClose: onCloseDecline
  } = useDisclosure()

  const handleDecline = async () => {
    setDeclining(true)

    const res = await kunFetchPut<KunResponse<{}>>(
      '/admin/resource-apply/decline',
      {
        resourceId: resource.id,
        reason
      }
    )
    kunErrorHandler(res, () => {
      toast.success('已拒绝该资源的发布申请')
      onCloseDecline()
    })
    setDeclining(false)
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" color="success" onPress={onOpenApprove}>
        同意发布
      </Button>
      <Button size="sm" color="danger" onPress={onOpenDecline}>
        拒绝发布
      </Button>

      <Modal isOpen={isOpenApprove} onClose={onCloseApprove}>
        <ModalContent>
          <ModalHeader>确认同意发布</ModalHeader>
          <ModalBody>
            确认要通过该资源的首次发布申请吗？通过后资源将对所有用户可见。
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
              确认通过
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isOpenDecline} onClose={onCloseDecline}>
        <ModalContent>
          <ModalHeader>拒绝该资源发布</ModalHeader>
          <ModalBody>
            <Textarea
              label="拒绝原因"
              placeholder="请填写拒绝该资源发布的具体原因，将会通知到上传用户..."
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
              确认拒绝
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

