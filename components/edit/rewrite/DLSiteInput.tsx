'use client'

import { Button, Input } from '@heroui/react'
import toast from 'react-hot-toast'
import { useRewritePatchStore } from '~/store/rewriteStore'
import { kunFetchPost } from '~/utils/kunFetch'

interface DlsiteResponse {
  rj_code: string
  title_default: string
  title_jp?: string
  title_en?: string
  release_date?: string
  tags?: string
}

const parseTags = (raw?: string) => {
  if (!raw) return [] as string[]
  return raw
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

export const DLSiteInput = ({ errors }: { errors?: string }) => {
  const { data, setData } = useRewritePatchStore()

  const handleFetch = async () => {
    const rawCode = data.dlsiteCode.trim()
    if (!rawCode) {
      toast.error('DLSite Code 不可为空')
      return
    }

    const normalized = rawCode.toUpperCase()
    if (!/^RJ\d+$/.test(normalized)) {
      toast.error('DLSite Code 需要以 RJ 开头')
      return
    }

    try {
      toast('正在从 DLSite 获取数据...')
      const result = await kunFetchPost<KunResponse<DlsiteResponse>>(
        '/edit/dlsite',
        { code: normalized }
      )

      if (typeof result === 'string') {
        toast.error(result)
        return
      }

      if (!result?.title_default) {
        toast.error('未找到对应的 DLSite 数据')
        return
      }

      const aliasExtras = [result.title_jp, result.title_en]
        .map((title) => title?.trim())
        .filter((title): title is string => !!title)
      const alias = [...new Set([...data.alias, ...aliasExtras])]
      const tags = [
        ...new Set([...data.tag, ...parseTags(result.tags)])
      ]

      setData({
        ...data,
        dlsiteCode: normalized,
        name: result.title_default,
        alias,
        tag: tags,
        released: result.release_date || data.released
      })

      toast.success('已获取 DLSite 数据并自动写入表单')
    } catch (error) {
      console.error(error)
      toast.error('DLSite API 请求失败, 请稍后重试')
    }
  }

  return (
    <div className="w-full space-y-2">
      <h2 className="text-xl">DLSite Code (可选)</h2>
      <Input
        variant="underlined"
        labelPlacement="outside"
        placeholder="请输入 DLSite Code, 例如 RJ01405813"
        value={data.dlsiteCode}
        onChange={(e) => setData({ ...data, dlsiteCode: e.target.value })}
        isInvalid={!!errors}
        errorMessage={errors}
      />
      <div className="flex items-center text-sm">
        {data.dlsiteCode && (
          <Button
            className="mr-4"
            color="primary"
            size="sm"
            onPress={handleFetch}
          >
            获取 DLSite 数据
          </Button>
        )}
      </div>
    </div>
  )
}
