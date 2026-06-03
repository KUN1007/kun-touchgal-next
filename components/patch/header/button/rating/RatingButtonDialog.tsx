'use client'

import { Modal } from '@heroui/modal'
import { RatingModal } from '~/components/patch/rating/RatingModal'

interface Props {
  patchId: number
  isOpen: boolean
  onClose: () => void
}

export const RatingButtonDialog = ({ patchId, isOpen, onClose }: Props) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isDismissable={false}
      isKeyboardDismissDisabled={true}
    >
      <RatingModal isOpen={isOpen} onClose={onClose} patchId={patchId} />
    </Modal>
  )
}

export default RatingButtonDialog
