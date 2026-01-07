'use client'

import { Button, Input } from '@heroui/react'
import toast from 'react-hot-toast'
import { kunFetchPost } from '~/utils/kunFetch'
import { useRewritePatchStore } from '~/store/rewriteStore'
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
  const { data, setData } = useRewritePatchStore()

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

      toast('正在同步 VNDB 数据...')
      const { titles: vnTitles, released: vnReleased } =
        await fetchVNDBDetails(vndbId)

      setData({
        ...data,
        vndbId,
        vndbRelationId: normalized,
        alias: [...new Set([...relationTitles, ...vnTitles])],
        released: relationReleased || vnReleased || data.released
      })

      toast.success('Release 数据同步完成!')
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
