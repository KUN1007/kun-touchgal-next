'use client'

import { useState } from 'react'
import { Card, CardBody, CardHeader, Input } from '@heroui/react'
import { useCreatePatchStore } from '~/store/editStore'
import { VNDBInput } from './VNDBInput'
import { VNDBRelationInput } from './VNDBRelationInput'
import { DLSiteInput } from './DLSiteInput'
import { AliasInput } from './AliasInput'
import { BannerImage } from './BannerImage'
import { PublishButton } from './PublishButton'
import { PatchIntroduction } from './PatchIntroduction'
import { ContentLimit } from './ContentLimit'
import { DuplicateCheckButton } from './DuplicateCheckButton'
import { BatchTag } from '../components/BatchTag'
import { ReleaseDateInput } from '../components/ReleaseDateInput'
import type { CreatePatchRequestData } from '~/store/editStore'

export const CreatePatch = () => {
  const { data, setData } = useCreatePatchStore()
  const [errors, setErrors] = useState<
    Partial<Record<keyof CreatePatchRequestData, string>>
  >({})

  return (
    <form className="w-full max-w-5xl py-4 mx-auto">
      <Card className="w-full">
        <CardHeader className="flex gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl shrink-0">创建新游戏</h1>
              <DuplicateCheckButton />
            </div>

            <p className="mt-2">
              游戏查重会使用 VNDB ID, VNDB Relation ID, DLsite Code
              以及游戏标题和别名进行查重
            </p>
          </div>
        </CardHeader>
        <CardBody className="mt-4 space-y-12">
          <VNDBInput errors={errors.vndbId} />
          <VNDBRelationInput errors={errors.vndbRelationId} />
          <DLSiteInput errors={errors.dlsiteCode} />

          <div className="space-y-2">
            <h2 className="text-xl">游戏名称 (必须)</h2>
            <Input
              isRequired
              variant="underlined"
              labelPlacement="outside"
              placeholder="输入游戏名称, 这会作为游戏的标题"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              isInvalid={!!errors.name}
              errorMessage={errors.name}
            />
          </div>

          <BannerImage errors={errors.banner} />

          <PatchIntroduction errors={errors.banner} />

          <AliasInput errors={errors.alias} />

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

          <PublishButton setErrors={setErrors} />
        </CardBody>
      </Card>
    </form>
  )
}
