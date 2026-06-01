'use client'

import { useEffect } from 'react'
import { useRewritePatchStore } from '~/store/rewriteStore'
import { kunMoyuMoe } from '~/config/moyu-moe'
import { getPatchPageTitle } from '~/utils/patch/getPatchPageTitle'
import type { Patch } from '~/types/api/patch'

interface Props {
  patch: Patch
  released: string
  isNsfwBlocked: boolean
}

export const PatchHeaderClientEffects = ({
  patch,
  released,
  isNsfwBlocked
}: Props) => {
  const setData = useRewritePatchStore((state) => state.setData)

  useEffect(() => {
    setData({
      id: patch.id,
      uniqueId: patch.uniqueId,
      vndbId: patch.vndbId ?? '',
      vndbRelationId: patch.vndbRelationId ?? '',
      bangumiId: patch.bangumiId ? String(patch.bangumiId) : '',
      steamId: patch.steamId ? String(patch.steamId) : '',
      dlsiteCode: patch.dlsiteCode ?? '',
      dlsiteCircleName: '',
      dlsiteCircleLink: '',
      vndbTags: [],
      vndbDevelopers: [],
      bangumiTags: [],
      bangumiDevelopers: [],
      steamTags: [],
      steamDevelopers: [],
      steamAliases: [],
      name: patch.name,
      introduction: patch.introduction,
      alias: patch.alias,
      tag: patch.tags,
      contentLimit: patch.contentLimit,
      released
    })
  }, [patch, released, setData])

  useEffect(() => {
    if (patch.contentLimit !== 'nsfw') {
      return
    }

    if (isNsfwBlocked) {
      document.title = ''
      return
    }

    document.title = `${getPatchPageTitle(patch)} - ${kunMoyuMoe.titleShort}`
  }, [isNsfwBlocked, patch])

  return null
}
