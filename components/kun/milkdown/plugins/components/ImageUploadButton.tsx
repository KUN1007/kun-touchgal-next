'use client'

import { useRef } from 'react'
import { ImagePlus } from 'lucide-react'
import { callCommand } from '@milkdown/utils'
import { insertImageCommand } from '@milkdown/preset-commonmark'
import toast from 'react-hot-toast'
import { checkImageValid, resizeImage } from '~/utils/resizeImage'
import { kunFetchFormData } from '~/utils/kunFetch'
import { errorReporter, kunErrorHandler } from '~/utils/kunErrorHandler'
import { MenuButton } from '../MenuButton'
import type { CmdKey } from '@milkdown/core'
import type { UseEditorReturn } from '@milkdown/react'

export const ImageUploadButton = ({
  editorInfo
}: {
  editorInfo: UseEditorReturn
}) => {
  const uploadImageInputRef = useRef<HTMLInputElement | null>(null)

  const { get } = editorInfo
  const call = <T,>(command: CmdKey<T>, payload?: T) => {
    return get()?.action(callCommand(command, payload))
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return
    input.value = ''

    if (!checkImageValid(file)) return

    const miniImage = await resizeImage(file, 1920, 1080).catch(() => null)
    if (!miniImage) return

    const formData = new FormData()
    formData.append('image', miniImage)

    toast('正在上传图片...')

    try {
      const res = await kunFetchFormData<
        KunResponse<{
          imageLink: string
        }>
      >('/user/image', formData)

      kunErrorHandler(res, (value) => {
        toast.success('上传图片成功')
        call(insertImageCommand.key, {
          src: value.imageLink,
          title: file.name,
          alt: file.name
        })
      })
    } catch (error) {
      errorReporter(error)
    }
  }

  return (
    <>
      <MenuButton
        tooltip="上传图片"
        icon={ImagePlus}
        onPress={() => uploadImageInputRef.current?.click()}
        ariaLabel="上传图片"
      />
      <input
        ref={uploadImageInputRef}
        type="file"
        accept=".jpg, .jpeg, .png, .webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  )
}
