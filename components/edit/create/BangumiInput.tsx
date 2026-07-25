'use client'

import { useEffect, useState } from 'react'
import { Button, Input } from '@heroui/react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { kunFetchGet, kunFetchPost } from '~/utils/kunFetch'
import { FetchPreview } from '~/components/edit/components/FetchPreview'
import type { PatchFormDataShape } from '~/components/edit/types'

interface BangumiPreview {
  name: string
  nameCn: string
  released: string
  tags: string[]
  developers: string[]
}

interface Props<T extends PatchFormDataShape> {
  errors?: string
  data: T
  setData: (data: T) => void
  excludeId?: number
}

export const BangumiInput = <T extends PatchFormDataShape>({
  errors,
  data,
  setData,
  excludeId
}: Props<T>) => {
  const [preview, setPreview] = useState<BangumiPreview | null>(null)
  const [duplicateUniqueId, setDuplicateUniqueId] = useState<string | null>(
    null
  )

  useEffect(() => {
    setPreview(null)
    setDuplicateUniqueId(null)
  }, [data.bangumiId])

  const handleFetch = async () => {
    const rawInput = data.bangumiId.trim()
    if (!rawInput) {
      toast.error('Bangumi ID 不可为空')
      return
    }

    if (!/^\d+$/.test(rawInput)) {
      toast.error('Bangumi ID 必须为纯数字')
      return
    }

    const duplicateResult = await kunFetchGet<
      KunResponse<{ uniqueId: string }>
    >('/edit/duplicate', {
      bangumiId: rawInput,
      ...(excludeId ? { excludeId: String(excludeId) } : {})
    })

    if (typeof duplicateResult !== 'string' && duplicateResult?.uniqueId) {
      setDuplicateUniqueId(duplicateResult.uniqueId)
      toast.error('发现重复游戏条目, 请勿重复提交')
      return
    }
    setDuplicateUniqueId(null)

    try {
      toast('正在从 Bangumi 获取数据...')
      const result = await kunFetchPost<KunResponse<BangumiPreview>>(
        '/edit/bangumi',
        { bangumiId: rawInput }
      )

      if (typeof result === 'string') {
        toast.error(result)
        return
      }

      const displayName = result.nameCn || result.name
      if (!displayName) {
        toast.error('未找到对应的 Bangumi 条目')
        return
      }

      setPreview(result)

      const extraAliases = [result.name, result.nameCn]
        .map((n) => n?.trim())
        .filter((n): n is string => !!n)
      const alias = [...new Set([...data.alias, ...extraAliases])].filter(
        (a) => a !== data.name
      )

      setData({
        ...data,
        alias,
        released: result.released || data.released,
        bangumiTags: result.tags,
        bangumiDevelopers: result.developers
      })

      toast.success(`确认: ${displayName}`)
    } catch (error) {
      setPreview(null)
      toast.error('Bangumi API 请求失败, 请稍后重试')
    }
  }

  return (
    <div className="w-full space-y-2">
      <h2 className="text-xl">Bangumi ID (可选)</h2>
      <Input
        variant="underlined"
        labelPlacement="outside"
        placeholder="请输入 Bangumi 条目 ID, 例如 172612"
        value={data.bangumiId}
        onChange={(e) => setData({ ...data, bangumiId: e.target.value })}
        isInvalid={!!errors}
        errorMessage={errors}
      />
      <div className="flex items-center gap-2 text-sm">
        {data.bangumiId && (
          <Button color="primary" size="sm" onPress={handleFetch}>
            获取 Bangumi 数据
          </Button>
        )}
        {duplicateUniqueId && (
          <Button
            as={Link}
            color="primary"
            target="_blank"
            href={`/${duplicateUniqueId}`}
            variant="flat"
            size="sm"
          >
            跳转到重复游戏
          </Button>
        )}
      </div>
      {preview && (
        <FetchPreview
          fields={[
            { label: '名称', value: preview.name },
            { label: '中文名', value: preview.nameCn },
            { label: '发售日期', value: preview.released },
            { label: '标签', value: preview.tags },
            { label: '开发商', value: preview.developers }
          ]}
        />
      )}
    </div>
  )
}
