'use client'

import { useEffect, useState } from 'react'
import { Button, Input } from '@heroui/react'
import toast from 'react-hot-toast'
import { kunFetchGet, kunFetchPost } from '~/utils/kunFetch'
import { fetchVNDBDetails } from '~/utils/vndb'
import { mergePatchAlias } from '~/utils/mergePatchAlias'
import { FetchPreview } from '~/components/edit/components/FetchPreview'
import type { PatchFormDataShape } from '~/components/edit/types'

interface RelationResponse {
  vndbId: string
  titles: string[]
  released: string
}

interface PreviewData {
  vndbId: string
  titles: string[]
  released: string
  tags: string[]
  developers: string[]
}

interface Props<T extends PatchFormDataShape> {
  errors?: string
  data: T
  setData: (data: T) => void
  enableDuplicateCheck?: boolean
  excludeId?: number
}

export const VNDBRelationInput = <T extends PatchFormDataShape>({
  errors,
  data,
  setData,
  enableDuplicateCheck = true,
  excludeId
}: Props<T>) => {
  const [preview, setPreview] = useState<PreviewData | null>(null)

  useEffect(() => {
    setPreview(null)
  }, [data.vndbRelationId])

  const handleFetchRelation = async () => {
    const rawInput = data.vndbRelationId.trim()
    if (!rawInput) {
      toast.error('VNDB Relation ID 不可为空')
      return
    }

    const normalized = rawInput.toLowerCase()
    if (!/^r\d+$/.test(normalized)) {
      toast.error('Relation ID 需要以 r 开头')
      return
    }

    try {
      toast('正在获取 Release 数据...')
      const relationResult = await kunFetchPost<KunResponse<RelationResponse>>(
        '/edit/vndb/relation',
        {
          relationId: normalized
        }
      )

      if (typeof relationResult === 'string') {
        toast.error(relationResult)
        return
      }

      const {
        vndbId,
        titles: relationTitles,
        released: relationReleased
      } = relationResult

      if (enableDuplicateCheck) {
        const duplicateResult = await kunFetchGet<
          KunResponse<{ uniqueId: string }>
        >('/edit/duplicate', {
          vndbId,
          vndbRelationId: normalized,
          dlsiteCode: data.dlsiteCode.trim().toUpperCase(),
          title: data.name.trim(),
          ...(excludeId ? { excludeId: String(excludeId) } : {})
        })

        if (typeof duplicateResult === 'string') {
          toast.error(duplicateResult)
          return
        }

        if (duplicateResult?.uniqueId) {
          toast.error(
            `与 VN 已重复 (ID: ${duplicateResult.uniqueId}), 请勿重复提交`
          )
          return
        }
      }

      toast('正在同步 VNDB 数据...')
      const {
        titles: vnTitles,
        released: vnReleased,
        tags,
        developers
      } = await fetchVNDBDetails(vndbId)

      const mergedTitles = [
        ...new Set([...relationTitles, ...vnTitles])
      ].filter((t) => t !== data.name)
      const finalReleased = relationReleased || vnReleased || data.released

      setPreview({
        vndbId,
        titles: mergedTitles,
        released: finalReleased,
        tags,
        developers
      })

      setData({
        ...data,
        vndbId,
        vndbRelationId: normalized,
        alias: mergePatchAlias(data.alias, mergedTitles, data.name),
        released: finalReleased,
        vndbTags: tags,
        vndbDevelopers: developers
      })

      toast.success('已获取 Release 数据! 并完成 VNDB 同步')
    } catch (error) {
      setPreview(null)
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
        toast.error('获取 Release 数据失败, 请稍���重试')
      }
    }
  }

  return (
    <div className="w-full space-y-2">
      <h2 className="text-xl">VNDB Relation ID (可选)</h2>
      <Input
        variant="underlined"
        labelPlacement="outside"
        placeholder="请输入 Release ID, 例如 r5879"
        value={data.vndbRelationId}
        onChange={(e) => setData({ ...data, vndbRelationId: e.target.value })}
        isInvalid={!!errors}
        errorMessage={errors}
      />
      <p className="text-sm text-default-500">
        Relation ID 可用于发布特定版本 (如移植、合集等)
        的信息，我们会自动读取关联 VN 的数据并保留当前版本的标题与发售日期
      </p>
      <div className="flex items-center text-sm">
        {data.vndbRelationId && (
          <Button
            className="mr-4"
            color="primary"
            size="sm"
            onPress={handleFetchRelation}
          >
            获取 Release 数据
          </Button>
        )}
      </div>
      {preview && (
        <FetchPreview
          fields={[
            { label: '关联 VNDB ID', value: preview.vndbId },
            { label: '别名', value: preview.titles },
            { label: '标签', value: preview.tags },
            { label: '开发商', value: preview.developers },
            { label: '发售日期', value: preview.released }
          ]}
        />
      )}
    </div>
  )
}
