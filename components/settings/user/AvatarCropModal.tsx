'use client'

import { useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import ReactCrop from 'react-image-crop'
import type { PercentCrop } from 'react-image-crop'
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
import { centerAspectCrop } from '~/components/kun/cropper/utils'
import { resolveAvatarCropRegion } from '~/components/settings/user/avatarCropRegion'

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
  // ReactCrop 不会替受控 crop 套 aspect, 也不会在挂载时把 % 归一化成 px, 所以正方形
  // 默认框要等图片有尺寸后由 onImageLoad 生成; state 只存百分比, 视口变化时不漂移
  const [crop, setCrop] = useState<PercentCrop>()
  const [loading, setLoading] = useState(false)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const onImageLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    setCrop(centerAspectCrop(width, height, 1, 50))
  }

  const getCroppedImg = async () => {
    if (!crop || !imageRef.current) return

    const img = imageRef.current
    const region = resolveAvatarCropRegion(
      crop,
      img.width,
      img.height,
      img.naturalWidth,
      img.naturalHeight
    )

    const canvas = document.createElement('canvas')
    canvas.width = region.width
    canvas.height = region.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      img,
      region.sx,
      region.sy,
      region.sw,
      region.sh,
      0,
      0,
      region.width,
      region.height
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
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            aspect={1}
          >
            <img
              ref={imageRef}
              src={image}
              alt="Upload"
              className="max-h-[60vh] w-auto"
              onLoad={onImageLoad}
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
            isDisabled={loading || !crop}
          >
            确定
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
