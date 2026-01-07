'use client'

import { useState } from 'react'
import { Button } from '@heroui/react'
import localforage from 'localforage'
import { useCreatePatchStore } from '~/store/editStore'
import toast from 'react-hot-toast'
import { kunFetchFormData } from '~/utils/kunFetch'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { patchCreateSchema } from '~/validations/edit'
import { useRouter } from '@bprogress/next'
import type { Dispatch, SetStateAction } from 'react'
import type { CreatePatchRequestData } from '~/store/editStore'

interface Props {
  setErrors: Dispatch<
    SetStateAction<Partial<Record<keyof CreatePatchRequestData, string>>>
  >
}

export const PublishButton = ({ setErrors }: Props) => {
  const router = useRouter()
  const { data, resetData } = useCreatePatchStore()

  const [creating, setCreating] = useState(false)
  const handleSubmit = async () => {
    const localeBannerBlob: Blob | null =
      await localforage.getItem('kun-patch-banner')
    if (!localeBannerBlob) {
      toast.error('未检测到预览图片')
      return
    }

    const result = patchCreateSchema.safeParse({
      ...data,
      banner: localeBannerBlob,
      alias: JSON.stringify(data.alias),
      tag: JSON.stringify(data.tag)
    })
    if (!result.success) {
      const newErrors: Partial<Record<keyof CreatePatchRequestData, string>> =
        {}
      result.error.errors.forEach((err) => {
        if (err.path.length) {
          newErrors[err.path[0] as keyof CreatePatchRequestData] = err.message
          toast.error(err.message)
        }
      })
      setErrors(newErrors)
      return
    } else {
      setErrors({})
    }

    const formDataToSend = new FormData()
    formDataToSend.append('banner', localeBannerBlob!)
    formDataToSend.append('name', data.name)
    formDataToSend.append('vndbId', data.vndbId)
    formDataToSend.append('vndbRelationId', data.vndbRelationId)
    formDataToSend.append('introduction', data.introduction)
    formDataToSend.append('alias', JSON.stringify(data.alias))
    formDataToSend.append('tag', JSON.stringify(data.tag))
    formDataToSend.append('released', data.released)
    formDataToSend.append('contentLimit', data.contentLimit)

    setCreating(true)
    toast('正在发布中 ... 这可能需要 10s 左右的时间, 这取决于您的网络环境')

    const res = await kunFetchFormData<
      KunResponse<{
        uniqueId: string
      }>
    >('/edit', formDataToSend)
    kunErrorHandler(res, async (value) => {
      resetData()
      await localforage.removeItem('kun-patch-banner')
      router.push(`/${value.uniqueId}`)
    })
    toast.success('发布完成, 正在为您跳转到资源介绍页面')
    setCreating(false)
  }

  return (
    <Button
      color="primary"
      onPress={handleSubmit}
      className="w-full mt-4"
      isDisabled={creating}
      isLoading={creating}
    >
      提交
    </Button>
  )
}
