'use client'

import { Button, Input } from '@heroui/react'
import toast from 'react-hot-toast'
import { kunFetchGet, kunFetchPost } from '~/utils/kunFetch'
import { useCreatePatchStore } from '~/store/editStore'
import { fetchVNDBDetails } from '~/utils/vndb'

interface RelationResponse {
  vndbId: string
  titles: string[]
  released: string
}

interface Props {
  errors?: string
}

export const VNDBRelationInput = ({ errors }: Props) => {
  const { data, setData } = useCreatePatchStore()

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
      const relationResult = await kunFetchPost<
        KunResponse<RelationResponse>
      >('/edit/vndb/relation', {
        relationId: normalized
      })

      if (typeof relationResult === 'string') {
        toast.error(relationResult)
        return
      }

      const { vndbId, titles: relationTitles, released: relationReleased } =
        relationResult

      const duplicateResult = await kunFetchGet<
        KunResponse<{ uniqueId: string }>
      >('/edit/duplicate', {
        vndbId,
        vndbRelationId: normalized,
        dlsiteCode: data.dlsiteCode.trim().toUpperCase(),
        title: data.name.trim()
      })

      if (typeof duplicateResult === 'string') {
        toast.error(duplicateResult)
        return
      }

      if (duplicateResult?.uniqueId) {
        toast.error(
          `该 VN 已存在（ID: ${duplicateResult.uniqueId}），请直接编辑原条目`
        )
        return
      }

      toast('正在从 VNDB 获取原作数据...')
      const { titles: vnTitles, released: vnReleased } = await fetchVNDBDetails(
        vndbId
      )

      setData({
        ...data,
        vndbId,
        vndbRelationId: normalized,
        alias: [...new Set([...relationTitles, ...vnTitles])],
        released: relationReleased || vnReleased || data.released
      })

      toast.success('获取 Release 数据成功! 已更新 VNDB 信息')
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
        toast.error('获取 Release 数据失败, 请稍后重试')
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
        Relation ID 可用于发布特定版本 (如移植、合集等) 的信息，我们会自动读取关联 VN
        的数据并保留当前版本的标题与发售日期
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
    </div>
  )
}
