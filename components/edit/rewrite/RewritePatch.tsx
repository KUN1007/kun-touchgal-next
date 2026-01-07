'use client'

import { useState } from 'react'
import { Button, Card, CardBody, CardHeader } from '@heroui/react'
import { useRewritePatchStore } from '~/store/rewriteStore'
import { KunDualEditorProvider } from '~/components/kun/milkdown/DualEditorProvider'
import toast from 'react-hot-toast'
import { kunFetchPut } from '~/utils/kunFetch'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { patchUpdateSchema } from '~/validations/edit'
import { useRouter } from '@bprogress/next'
import { GameNameInput } from './GameNameInput'
import { AliasManager } from './AliasManager'
import { ContentLimit } from './ContentLimit'
import { BatchTag } from '../components/BatchTag'
import { ReleaseDateInput } from '../components/ReleaseDateInput'
import { VNDBInput } from './VNDBInput'
import { VNDBRelationInput } from './VNDBRelationInput'
import { DLSiteInput } from './DLSiteInput'
import type { RewritePatchData } from '~/store/rewriteStore'

export const RewritePatch = () => {
  const router = useRouter()
  const { data, setData } = useRewritePatchStore()
  const [errors, setErrors] = useState<
    Partial<Record<keyof RewritePatchData, string>>
  >({})

  const addAlias = (newAlias: string) => {
    const alias = newAlias.trim()
    if (data.alias.includes(alias)) {
      toast.error('请不要使用重复的别名')
      return
    }
    if (newAlias.trim()) {
      setData({ ...data, alias: [...data.alias, alias] })
    }
  }

  const [rewriting, setRewriting] = useState(false)
  const handleSubmit = async () => {
    const result = patchUpdateSchema.safeParse(data)
    if (!result.success) {
      const newErrors: Partial<Record<keyof RewritePatchData, string>> = {}
      result.error.errors.forEach((err) => {
        if (err.path.length) {
          newErrors[err.path[0] as keyof RewritePatchData] = err.message
          toast.error(err.message)
        }
      })
      setErrors(newErrors)
      return
    } else {
      setErrors({})
    }

    setRewriting(true)

    const res = kunFetchPut<KunResponse<{}>>('/edit', { ...data })
    kunErrorHandler(res, async () => {
      router.push(`/${data.uniqueId}`)
    })
    toast.success('重新编辑成功, 由于缓存影响, 您的更改将在至多 30 秒后生效')
    setRewriting(false)
  }

  return (
    <form className="flex-1 w-full p-4 mx-auto">
      <Card className="w-full">
        <CardHeader className="flex gap-3">
          <div className="flex flex-col">
            <p className="text-2xl">编辑游戏信息</p>
          </div>
        </CardHeader>
        <CardBody className="mt-4 space-y-12">
          <VNDBInput
            vndbId={data.vndbId}
            setVNDBId={(id) =>
              setData({
                ...data,
                vndbId: id
              })
            }
            errors={errors.vndbId}
          />
          <VNDBRelationInput errors={errors.vndbRelationId} />
          <DLSiteInput errors={errors.dlsiteCode} />

          <GameNameInput
            name={data.name}
            onChange={(name) => setData({ ...data, name })}
            error={errors.name}
          />

          <div className="space-y-2">
            <h2 className="text-xl">游戏介绍 (可选)</h2>
            {errors.introduction && (
              <p className="text-xs text-danger-500">{errors.introduction}</p>
            )}
            <KunDualEditorProvider storeName="patchRewrite" />
          </div>

          <AliasManager
            aliasList={data.alias}
            onAddAlias={addAlias}
            onRemoveAlias={(index) =>
              setData({
                ...data,
                alias: data.alias.filter((_, i) => i !== index)
              })
            }
            errors={errors.alias}
          />

          <ReleaseDateInput
            date={data.released}
            setDate={(date) => {
              setData({ ...data, released: date })
            }}
            errors={errors.released}
          />

          <BatchTag
            initialTag={data.tag}
            saveTag={(tag) =>
              setData({
                ...data,
                tag
              })
            }
            errors={errors.tag}
          />

          <ContentLimit errors={errors.contentLimit} />

          <Button
            color="primary"
            className="w-full mt-4"
            onPress={handleSubmit}
            isLoading={rewriting}
            isDisabled={rewriting}
          >
            提交
          </Button>
        </CardBody>
      </Card>
    </form>
  )
}
