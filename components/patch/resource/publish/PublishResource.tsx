'use client'

import { z } from 'zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@heroui/button'
import { Link } from '@heroui/link'
import {
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress
} from '@heroui/react'
import toast from 'react-hot-toast'
import { kunFetchPost } from '~/utils/kunFetch'
import { patchResourceCreateSchema } from '~/validations/patch'
import { ResourceLinksInput } from './ResourceLinksInput'
import { ResourceDetailsForm } from './ResourceDetailsForm'
import { ResourceTypeSelect } from './ResourceTypeSelect'
import { ResourceSectionSelect } from './ResourceSectionSelect'
import { Upload } from 'lucide-react'
import { FileUploadContainer } from '../upload/FileUploadContainer'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { useUserStore } from '~/store/userStore'
import type { PatchResource } from '~/types/api/patch'

export type ResourceFormData = z.infer<typeof patchResourceCreateSchema>

interface CreateResourceProps {
  patchId: number
  onClose: () => void
  onSuccess?: (res: PatchResource) => void
}

const userRoleStorageMap: Record<number, string> = {
  1: 'user',
  2: 's3',
  3: 'touchgal',
  4: 'touchgal'
}

export const PublishResource = ({
  patchId,
  onClose,
  onSuccess
}: CreateResourceProps) => {
  const [creating, setCreating] = useState(false)
  const [uploadingResource, setUploadingResource] = useState(false)
  const user = useUserStore((state) => state.user)

  const {
    control,
    reset,
    setValue,
    formState: { errors },
    watch
  } = useForm<ResourceFormData>({
    resolver: zodResolver(patchResourceCreateSchema),
    defaultValues: {
      patchId,
      storage: userRoleStorageMap[user.role],
      name: '',
      section: user.role > 2 ? 'galgame' : 'patch',
      hash: '',
      content: '',
      code: '',
      type: [],
      language: [],
      platform: [],
      size: '',
      password: '',
      note: ''
    }
  })

  const handleRewriteResource = async () => {
    setCreating(true)
    const res = await kunFetchPost<KunResponse<PatchResource>>(
      '/patch/resource',
      watch()
    )
    setCreating(false)
    kunErrorHandler(res, (value) => {
      reset()
      onSuccess?.(value)
      toast.success('资源发布成功')
    })
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

  const progress = Math.min((user.dailyUploadLimit / 5120) * 100, 100)

  return (
    <ModalContent>
      <ModalHeader className="flex-col space-y-2">
        <h3 className="text-lg">创建资源</h3>
        <div className="text-sm font-medium text-default-500">
          {user.role > 1 ? (
            <div className="space-y-1">
              <p>
                作为创作者, 您每天有 5GB (5120MB) 的上传额度, 该额度每天早上 8
                点重置
              </p>
              <p>{`您今日已使用存储 ${user.dailyUploadLimit.toFixed(3)} MB`}</p>
              <Progress size="sm" value={progress} aria-label="已使用存储" />
            </div>
          ) : (
            <>
              您需要先自行发布 3 个补丁资源以使用我们的对象存储, 当您发布完成 3
              个合法补丁后, 您可以 <Link href="/apply">申请成为创作者</Link>
            </>
          )}
        </div>
      </ModalHeader>

      <ModalBody>
        <form className="space-y-6">
          <ResourceSectionSelect
            errors={errors}
            section={watch().section}
            setSection={(content) => {
              setValue('section', content)
              setValue('storage', userRoleStorageMap[user.role])
            }}
          />

          <ResourceTypeSelect
            section={watch().section}
            control={control}
            errors={errors}
          />

          {watch().storage === 's3' && (
            <FileUploadContainer
              onSuccess={handleUploadSuccess}
              handleRemoveFile={() => reset()}
              setUploadingResource={setUploadingResource}
            />
          )}

          {(watch().storage !== 's3' || watch().content) && (
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

      <ModalFooter className="flex-col items-end">
        <div className="space-x-2">
          <Button color="danger" variant="light" onPress={onClose}>
            取消
          </Button>
          <Button
            color="primary"
            disabled={creating}
            isLoading={creating}
            endContent={<Upload className="size-4" />}
            onPress={handleRewriteResource}
          >
            发布资源
          </Button>
        </div>

        {creating && (
          <>
            <p>
              我们正在将您的补丁从服务器同步到云端, 请稍后 ...
              取决于您的网络环境, 这也许需要一段时间
            </p>
          </>
        )}
      </ModalFooter>
    </ModalContent>
  )
}
