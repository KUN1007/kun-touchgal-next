'use client'

import { useEffect, useState } from 'react'
import { useRewritePatchStore } from '~/store/rewriteStore'
import { PatchHeaderTabs } from './Tabs'
import { PatchHeaderInfo } from './Info'
import { KunAutoImageViewer } from '~/components/kun/image-viewer/AutoImageViewer'
import { KunNull } from '~/components/kun/Null'
import type { Patch, PatchIntroduction } from '~/types/api/patch'

interface PatchHeaderProps {
  patch: Patch
  intro: PatchIntroduction
  uid?: number
}

export const PatchHeaderContainer = ({
  patch,
  intro,
  uid
}: PatchHeaderProps) => {
  const { setData } = useRewritePatchStore()
  const [selected, setSelected] = useState('introduction')

  useEffect(() => {
    setData({
      id: patch.id,
      uniqueId: patch.uniqueId,
      vndbId: patch.vndbId ?? '',
      vndbRelationId: patch.vndbRelationId ?? '',
      dlsiteCode: patch.dlsiteCode ?? '',
      name: patch.name,
      introduction: patch.introduction,
      alias: patch.alias,
      tag: patch.tags,
      contentLimit: patch.contentLimit,
      released: intro.released
    })
  }, [])

  return (
    <div className="relative w-full mx-auto max-w-7xl">
      {patch.contentLimit === 'nsfw' && !uid ? (
        <KunNull message="请登录后查看 NSFW 游戏" />
      ) : (
        <>
          <KunAutoImageViewer />

          <PatchHeaderInfo
            patch={patch}
            handleClickDownloadNav={() => setSelected('resources')}
          />

          <PatchHeaderTabs
            id={patch.id}
            vndbId={patch.vndbId || ''}
            intro={intro}
            uid={uid}
            selected={selected}
            setSelected={setSelected}
          />
        </>
      )}
    </div>
  )
}
