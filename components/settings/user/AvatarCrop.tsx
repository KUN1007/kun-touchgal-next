'use client'

import { useState } from 'react'
import type { ChangeEvent } from 'react'
import dynamic from 'next/dynamic'
import { useShallow } from 'zustand/react/shallow'
import { Avatar } from '@heroui/react'
import { useDisclosure } from '@heroui/react'
import { useUserStore } from '~/store/userStore'
import { Camera } from 'lucide-react'

const AvatarCropModal = dynamic(
  () => import('./AvatarCropModal').then((mod) => mod.AvatarCropModal),
  { ssr: false }
)

export const AvatarCrop = () => {
  const { user, setUser } = useUserStore(
    useShallow((state) => ({ user: state.user, setUser: state.setUser }))
  )
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [image, setImage] = useState<string | null>(null)
  const [croppedImage, setCroppedImage] = useState<string | null>(null)

  const onSelectFile = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        setImage(reader.result as string)
        onOpen()
      })
      reader.readAsDataURL(e.target.files[0])
    }
  }

  const handleUploaded = (croppedImage: string, avatar: string) => {
    setCroppedImage(croppedImage)
    setUser({ ...user, avatar })
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative cursor-pointer group">
        <div className="relative group">
          {croppedImage ? (
            <img
              src={croppedImage}
              alt="Cropped avatar"
              className="object-cover rounded-full size-16"
            />
          ) : (
            <Avatar
              name={user.name}
              src={user.avatar}
              className="w-16 h-16"
              color="primary"
            />
          )}

          <label
            htmlFor="avatar-upload"
            className="absolute inset-0 flex items-center justify-center transition-opacity rounded-full opacity-0 cursor-pointer bg-black/50 group-hover:opacity-100"
          >
            <Camera className="size-6 text-background" />
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onSelectFile}
          />
        </div>
      </div>

      {isOpen && image && (
        <AvatarCropModal
          image={image}
          isOpen={isOpen}
          onClose={onClose}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  )
}
