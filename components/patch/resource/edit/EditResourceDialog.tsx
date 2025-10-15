'use client'

import { z } from 'zod'
import { Button } from '@heroui/button'
import {
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader
} from '@heroui/react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { kunFetchPut } from '~/utils/kunFetch'
import { patchResourceCreateSchema } from '~/validations/patch'
import { ResourceLinksInput } from '../publish/ResourceLinksInput'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { ResourceDetailsForm } from '../publish/ResourceDetailsForm'
import { FileUploadContainer } from '../upload/FileUploadContainer'
import { ResourceSectionSelect } from '../publish/ResourceSectionSelect'
import type { PatchResource } from '~/types/api/patch'

type EditResourceFormData = z.infer<typeof patchResourceCreateSchema>

interface EditResourceDialogProps {
  resource: PatchResource
  onClose: () => void
  onSuccess: (resource: PatchResource) => void
  type?: 'patch' | 'admin'
}

export const EditResourceDialog = ({
  resource,
  onClose,
  onSuccess,
  type = 'patch'
}: EditResourceDialogProps) => {
  const [editing, setEditing] = useState(false)
  const [uploadingResource, setUploadingResource] = useState(false)

  const {
    control,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<EditResourceFormData>({
    resolver: zodResolver(patchResourceCreateSchema),
    defaultValues: resource
  })

  const handleUpdateResource = async () => {
    setEditing(true)
    const res = await kunFetchPut<KunResponse<PatchResource>>(
      `/${type}/resource`,
      { resourceId: resource.id, ...watch() }
    )
    kunErrorHandler(res, (value) => {
      reset()
      onSuccess(value)
      toast.success('资源更新成功')
    })
    setEditing(false)
  }

  const handleUploadSuccess = (
    storage: string,
    hash: string,
    content: string,
    size: string
  ) => {
    setValue('storage', storage)
    setValue('hash', hash)
    setValue('content', content)
    setValue('size', size)
  }

  const handleRemoveFile = () => {
    setValue('hash', '')
    setValue('content', '')
    setValue('size', '')
  }

  return (
    <ModalContent>
      <ModalHeader className="flex-col space-y-2">
        <h3 className="text-lg">更改资源链接</h3>
        <p className="text-sm font-medium text-default-500">
          若您想要更改您的对象存储链接, 您现在可以直接上传新文件,
          系统会自动更新云端文件, 无需删除后重新发布
        </p>
      </ModalHeader>

      <ModalBody>
        <form className="space-y-6">
          <ResourceSectionSelect
            errors={errors}
            section={watch().section}
            setSection={(content) => setValue('section', content)}
          />

          {watch().storage === 's3' && (
            <FileUploadContainer
              onSuccess={handleUploadSuccess}
              handleRemoveFile={handleRemoveFile}
              setUploadingResource={setUploadingResource}
            />
          )}

          {(watch().storage === 'user' || watch().content) && (
            <ResourceLinksInput
              errors={errors}
              storage={watch().storage}
              content={watch().content}
              size={watch().size}
              setContent={(content) => setValue('content', content)}
              setSize={(size) => setValue('size', size)}
            />
          )}
          <ResourceDetailsForm control={control} errors={errors} />
        </form>
      </ModalBody>

      <ModalFooter>
        <Button color="danger" variant="light" onPress={onClose}>
          取消
        </Button>
        <Button
          color="primary"
          disabled={editing || uploadingResource}
          isLoading={editing || uploadingResource}
          onPress={handleUpdateResource}
        >
          {editing
            ? '更新中...'
            : uploadingResource
              ? '正在上传补丁资源中...'
              : '保存'}
        </Button>
      </ModalFooter>
    </ModalContent>
  )
}
