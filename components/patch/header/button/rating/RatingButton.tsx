'use client'

import { Button, Tooltip, Modal, useDisclosure } from '@heroui/react'
import { Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { useUserStore } from '~/store/userStore'
import { RatingModal } from '~/components/patch/rating/RatingModal'

interface Props {
  patchId: number
}

export const RatingButton = ({ patchId }: Props) => {
  const { user } = useUserStore((state) => state)
  const { isOpen, onOpen, onClose } = useDisclosure()

  const onPress = () => {
    if (!user.uid) {
      toast.error('请登陆后再评分')
      return
    }
    onOpen()
  }

  return (
    <>
      <Tooltip content="提交评分">
        <Button
          variant="flat"
          color="primary"
          startContent={<Star className="size-4" />}
          size="sm"
          onPress={onPress}
        >
          评分
        </Button>
      </Tooltip>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        isDismissable={false}
        isKeyboardDismissDisabled={true}
      >
        <RatingModal isOpen={isOpen} onClose={onClose} patchId={patchId} />
      </Modal>
    </>
  )
}
