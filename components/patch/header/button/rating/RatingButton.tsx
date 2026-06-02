'use client'

import dynamic from 'next/dynamic'
import {
  Button,
  Tooltip,
  Modal,
  ModalBody,
  ModalContent,
  useDisclosure
} from '@heroui/react'
import { Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { useUserStore } from '~/store/userStore'
import { KunLoading } from '~/components/kun/Loading'

const RatingModal = dynamic(
  () =>
    import('~/components/patch/rating/RatingModal').then(
      (mod) => mod.RatingModal
    ),
  {
    ssr: false,
    loading: () => (
      <ModalContent>
        <ModalBody className="py-6">
          <KunLoading className="min-h-48" hint="正在加载评分弹窗..." />
        </ModalBody>
      </ModalContent>
    )
  }
)

interface Props {
  patchId: number
}

export const RatingButton = ({ patchId }: Props) => {
  const user = useUserStore((state) => state.user)
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
        {isOpen && (
          <RatingModal isOpen={isOpen} onClose={onClose} patchId={patchId} />
        )}
      </Modal>
    </>
  )
}
