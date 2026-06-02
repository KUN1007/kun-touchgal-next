'use client'

import { useShallow } from 'zustand/react/shallow'
import { useState } from 'react'
import { Button } from '@heroui/react'
import localforage from 'localforage'
import { useCreatePatchStore } from '~/store/editStore'
import toast from 'react-hot-toast'
import { kunFetchFormData } from '~/utils/kunFetch'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { patchCreateSchema } from '~/validations/edit'
import { useRouter } from '@bprogress/next'
import { cn } from '~/utils/cn'
import { normalizeStringArray } from '~/utils/normalizeStringArray'
import type { Dispatch, SetStateAction } from 'react'
import type { CreatePatchRequestData } from '~/store/editStore'

interface Props {
  setErrors: Dispatch<
    SetStateAction<Partial<Record<keyof CreatePatchRequestData, string>>>
  >
  className?: string
}

export const PublishButton = ({ setErrors, className }: Props) => {
  const router = useRouter()
  const { data, resetData } = useCreatePatchStore(
    useShallow((state) => ({ data: state.data, resetData: state.resetData }))
  )

  const [creating, setCreating] = useState(false)
  const handleSubmit = async () => {
    const localeBannerBlob: Blob | null =
      await localforage.getItem('kun-patch-banner')
    const localeOriginalBannerBlob: Blob | null = await localforage.getItem(
      'kun-patch-banner-original'
    )
    if (!localeBannerBlob) {
      toast.error('未检测到预览图片')
      return
    }

    const sanitizedAlias = normalizeStringArray(data.alias)
    const sanitizedTag = normalizeStringArray(data.tag)

    const result = patchCreateSchema.safeParse({
      ...data,
      banner: localeBannerBlob,
      alias: JSON.stringify(sanitizedAlias),
      tag: JSON.stringify(sanitizedTag),
      vndbTags: JSON.stringify(data.vndbTags),
      vndbDevelopers: JSON.stringify(data.vndbDevelopers),
      bangumiTags: JSON.stringify(data.bangumiTags),
      bangumiDevelopers: JSON.stringify(data.bangumiDevelopers),
      steamTags: JSON.stringify(data.steamTags),
      steamDevelopers: JSON.stringify(data.steamDevelopers),
      steamAliases: JSON.stringify(data.steamAliases)
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
    if (localeOriginalBannerBlob) {
      formDataToSend.append('bannerOriginal', localeOriginalBannerBlob)
    }
    formDataToSend.append('name', data.name)
    formDataToSend.append('vndbId', data.vndbId)
    formDataToSend.append('vndbRelationId', data.vndbRelationId)
    formDataToSend.append('bangumiId', data.bangumiId)
    formDataToSend.append('steamId', data.steamId)
    formDataToSend.append('dlsiteCode', data.dlsiteCode)
    formDataToSend.append('dlsiteCircleName', data.dlsiteCircleName)
    formDataToSend.append('dlsiteCircleLink', data.dlsiteCircleLink)
    formDataToSend.append('vndbTags', JSON.stringify(data.vndbTags))
    formDataToSend.append('vndbDevelopers', JSON.stringify(data.vndbDevelopers))
    formDataToSend.append('bangumiTags', JSON.stringify(data.bangumiTags))
    formDataToSend.append(
      'bangumiDevelopers',
      JSON.stringify(data.bangumiDevelopers)
    )
    formDataToSend.append('steamTags', JSON.stringify(data.steamTags))
    formDataToSend.append(
      'steamDevelopers',
      JSON.stringify(data.steamDevelopers)
    )
    formDataToSend.append('steamAliases', JSON.stringify(data.steamAliases))
    formDataToSend.append('introduction', data.introduction)
    formDataToSend.append('alias', JSON.stringify(sanitizedAlias))
    formDataToSend.append('tag', JSON.stringify(sanitizedTag))
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
      await localforage.removeItem('kun-patch-banner-original')
      router.push(`/${value.uniqueId}`)
    })
    toast.success('发布完成, 正在为您跳转到资源介绍页面')
    setCreating(false)
  }

  return (
    <Button
      color="primary"
      onPress={handleSubmit}
      className={cn('w-full mt-4', className)}
      isDisabled={creating}
      isLoading={creating}
    >
      提交
    </Button>
  )
}
