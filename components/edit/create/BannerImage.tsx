'use client'

import { useEffect, useState } from 'react'
import localforage from 'localforage'
import toast from 'react-hot-toast'
import { dataURItoBlob } from '~/utils/dataURItoBlob'
import { compressDataURLToWebp } from '~/utils/resizeImage'
import { KunImageCropper } from '~/components/kun/cropper/KunImageCropper'

const MAX_ORIGINAL_BANNER_SIZE = 4 * 1024 * 1024

interface Props {
  errors: string | undefined
}

export const BannerImage = ({ errors }: Props) => {
  const [initialUrl, setInitialUrl] = useState<string>('')

  useEffect(() => {
    return () => {
      if (initialUrl) {
        URL.revokeObjectURL(initialUrl)
      }
    }
  }, [initialUrl])

  useEffect(() => {
    const fetchData = async () => {
      const localeBannerBlob: Blob | null =
        await localforage.getItem('kun-patch-banner')
      if (localeBannerBlob) {
        setInitialUrl(URL.createObjectURL(localeBannerBlob))
      }
    }
    fetchData()
  }, [])

  const removeBanner = async () => {
    await localforage.removeItem('kun-patch-banner')
    await localforage.removeItem('kun-patch-banner-original')
    setInitialUrl('')
  }

  const onImageComplete = async (croppedImage: string) => {
    const imageBlob = dataURItoBlob(croppedImage)
    await localforage.setItem('kun-patch-banner', imageBlob)
  }

  const onOriginalImageComplete = async (originalImage: string) => {
    try {
      const imageBlob = await compressDataURLToWebp(originalImage, {
        maxSizeBytes: MAX_ORIGINAL_BANNER_SIZE
      })
      await localforage.setItem('kun-patch-banner-original', imageBlob)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '原图处理失败')
      await localforage.removeItem('kun-patch-banner-original')
    }
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xl">封面图片 (必须)</h2>
      {errors && <p className="text-xs text-danger-500">{errors}</p>}

      <KunImageCropper
        aspect={{ x: 16, y: 9 }}
        initialImage={initialUrl}
        description="您的预览图片将会被固定为 1920 × 1080 分辨率"
        onImageComplete={onImageComplete}
        onOriginalImageComplete={onOriginalImageComplete}
        removeImage={removeBanner}
      />
    </div>
  )
}
