'use client'

import { useRef, useState } from 'react'
import ReactCrop from 'react-image-crop'
import type { Crop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader
} from '@heroui/react'
import { dataURItoBlob } from '~/utils/dataURItoBlob'
import { kunFetchFormData } from '~/utils/kunFetch'
import toast from 'react-hot-toast'
import { errorReporter, kunErrorHandler } from '~/utils/kunErrorHandler'

interface Props {
  image: string
  isOpen: boolean
  onClose: () => void
  onUploaded: (croppedImage: string, avatar: string, pending?: boolean) => void
}

export const AvatarCropModal = ({
  image,
  isOpen,
  onClose,
  onUploaded
}: Props) => {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 50,
    height: 50,
    x: 25,
    y: 25
  })
  const [loading, setLoading] = useState(false)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const getCroppedImg = async () => {
    if (!crop || !imageRef.current) return

    const canvas = document.createElement('canvas')
    const scaleX = imageRef.current.naturalWidth / imageRef.current.width
    const scaleY = imageRef.current.naturalHeight / imageRef.current.height

    canvas.width = crop.width
    canvas.height = crop.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(
      imageRef.current,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    )

    const base64Image = canvas.toDataURL('image/webp', 0.77)
    const avatarBlob = dataURItoBlob(base64Image)

    const formData = new FormData()
    formData.append('avatar', avatarBlob)

    setLoading(true)
    try {
      const res = await kunFetchFormData<
        KunResponse<{ avatar: string; pending?: boolean }>
      >('/user/setting/avatar', formData)
      kunErrorHandler(res, (value) => {
        toast.success('更新头像成功!')
        onUploaded(base64Image, value.avatar, value.pending)
        onClose()
      })
    } catch (error) {
      errorReporter(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} placement="center" size="2xl">
      <ModalContent>
        <ModalHeader>裁剪头像</ModalHeader>
        <ModalBody className="flex items-center justify-center">
          <ReactCrop
            keepSelection={true}
            crop={crop}
            onChange={(c) => setCrop(c)}
            aspect={1}
          >
            <img
              ref={imageRef}
              src={image}
              alt="Upload"
              className="max-h-[60vh] w-auto"
            />
          </ReactCrop>
        </ModalBody>
        <ModalFooter>
          <Button color="danger" variant="light" onPress={onClose}>
            取消
          </Button>
          <Button
            color="primary"
            onPress={getCroppedImg}
            isLoading={loading}
            isDisabled={loading}
          >
            确定
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
