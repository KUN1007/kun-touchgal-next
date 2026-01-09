'use client'

import { Button, Input } from '@heroui/react'
import toast from 'react-hot-toast'
import { fetchVNDBDetails } from '~/utils/vndb'
import type { PatchFormDataShape } from '~/components/edit/types'

interface Props<T extends PatchFormDataShape> {
  errors: string | undefined
  data: T
  setData: (data: T) => void
}

export const VNDBInput = <T extends PatchFormDataShape>({
  errors,
  data,
  setData
}: Props<T>) => {
  const handleFetchData = async () => {
    const rawInput = data.vndbId.trim()
    if (!rawInput) {
      toast.error('VNDB ID 不可为空')
      return
    }

    const normalizedInput = rawInput.toLowerCase()
    if (!/^v\d+$/.test(normalizedInput)) {
      toast.error('VNDB ID 需要以 v 开头')
      return
    }

    try {
      toast('正在从 VNDB 获取数据...')
      const { titles, released } = await fetchVNDBDetails(normalizedInput)

      setData({
        ...data,
        vndbId: normalizedInput,
        alias: [...new Set(titles)],
        released: released || data.released
      })

      toast.success('获取数据成功! 已为您自动添加游戏别名')
    } catch (error) {
      console.error(error)
      if (
        error instanceof Error &&
        (error.message === 'VNDB_API_ERROR' ||
          error.message === 'VNDB_NOT_FOUND')
      ) {
        const message =
          error.message === 'VNDB_NOT_FOUND'
            ? '未找到对应的 VNDB 数据'
            : 'VNDB API 请求失败, 请稍后重试'
        toast.error(message)
      } else {
        toast.error('VNDB API 请求失败, 请稍后重试')
      }
    }
  }

  return (
    <div className="w-full space-y-2">
      <h2 className="text-xl">VNDB ID (可选)</h2>
      <Input
        variant="underlined"
        labelPlacement="outside"
        placeholder="请输入 VNDB ID, 例如 v19658"
        value={data.vndbId}
        onChange={(e) => setData({ ...data, vndbId: e.target.value })}
        isInvalid={!!errors}
        errorMessage={errors}
      />
      <div className="flex items-center text-sm">
        {data.vndbId && (
          <Button
            className="mr-4"
            color="primary"
            size="sm"
            onPress={handleFetchData}
          >
            获取 VNDB 数据
          </Button>
        )}
      </div>
    </div>
  )
}
