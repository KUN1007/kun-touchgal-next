'use client'

import { Button, Input } from '@heroui/react'
import { useRewritePatchStore } from '~/store/rewriteStore'
import toast from 'react-hot-toast'
import { fetchVNDBDetails } from '~/utils/vndb'

interface Props {
  vndbId: string
  setVNDBId: (vndbId: string) => void
  errors?: string
}

export const VNDBInput = ({ vndbId, setVNDBId, errors }: Props) => {
  const { data, setData } = useRewritePatchStore()

  const handleFetchVNDBData = async () => {
    if (!data.vndbId.trim()) {
      toast.error('VNDB ID 不可为空')
      return
    }

    const normalized = data.vndbId.trim().toLowerCase()
    if (!/^v\d+$/.test(normalized)) {
      toast.error('VNDB ID 需要以 v 开头')
      return
    }

    toast('正在从 VNDB 获取数据...')
    try {
      const { titles, released } = await fetchVNDBDetails(normalized)

      setData({
        ...data,
        vndbId: normalized,
        alias: [...new Set(titles)],
        released: released || data.released
      })
      setVNDBId(normalized)

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
        value={vndbId}
        onChange={(e) => setVNDBId(e.target.value)}
        isInvalid={!!errors}
        errorMessage={errors}
      />
      <p className="text-sm">
        提示: VNDB ID 需要 VNDB 官网 (vndb.org)
        获取，当进入对应游戏的页面，游戏页面的 URL (形如
        https://vndb.org/v19658) 中的 v19658 就是 VNDB ID
      </p>
      <p className="text-sm text-default-500">
        <b>如果您点击获取数据, 您填写好的发售日期与别名有可能被覆盖</b>
      </p>
      <div className="flex items-center text-sm">
        {data.vndbId && (
          <Button
            className="mr-4"
            color="primary"
            size="sm"
            onPress={handleFetchVNDBData}
          >
            获取数据
          </Button>
        )}
      </div>
    </div>
  )
}
