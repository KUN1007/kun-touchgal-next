'use client'

import { useEffect, useState, useRef, type Key } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Tab, Tabs } from '@heroui/tabs'
import { IntroductionTab } from '~/components/patch/introduction/IntroductionTab'
import { KunLoading } from '~/components/kun/Loading'
import type { PatchIntroduction } from '~/types/api/patch'

type PatchTabKey = 'introduction' | 'resources' | 'comments' | 'rating'

interface PatchHeaderProps {
  id: number
  vndbId: string
  uid?: number
  intro: PatchIntroduction
}

interface SearchParamsLike {
  get: (key: string) => string | null
  toString: () => string
}

const ResourceTab = dynamic(
  () =>
    import('~/components/patch/resource/ResourceTab').then(
      (mod) => mod.ResourceTab
    ),
  {
    ssr: false,
    loading: () => (
      <KunLoading className="min-h-64" hint="正在加载资源链接..." />
    )
  }
)

const CommentTab = dynamic(
  () =>
    import('~/components/patch/comment/CommentTab').then(
      (mod) => mod.CommentTab
    ),
  {
    ssr: false,
    loading: () => <KunLoading className="min-h-64" hint="正在加载讨论版..." />
  }
)

const RatingTab = dynamic(
  () =>
    import('~/components/patch/rating/RatingTab').then((mod) => mod.RatingTab),
  {
    ssr: false,
    loading: () => (
      <KunLoading className="min-h-64" hint="正在加载游戏评价..." />
    )
  }
)

const isPatchTabKey = (value: string | null): value is PatchTabKey => {
  return (
    value === 'introduction' ||
    value === 'resources' ||
    value === 'comments' ||
    value === 'rating'
  )
}

const getSelectedTab = (searchParams: SearchParamsLike): PatchTabKey => {
  const targetTab = searchParams.get('tab')

  if (targetTab === 'comments' || searchParams.get('commentId')) {
    return 'comments'
  }

  if (targetTab === 'rating' || searchParams.get('ratingId')) {
    return 'rating'
  }

  if (targetTab === 'resources' || searchParams.get('resourceId')) {
    return 'resources'
  }

  return isPatchTabKey(targetTab) ? targetTab : 'introduction'
}

const hasTabDeepLink = (searchParams: SearchParamsLike) => {
  return Boolean(
    searchParams.get('tab') ||
      searchParams.get('commentId') ||
      searchParams.get('ratingId') ||
      searchParams.get('resourceId')
  )
}

export const PatchHeaderTabs = ({
  id,
  vndbId,
  uid,
  intro
}: PatchHeaderProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabsRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<PatchTabKey>(() =>
    getSelectedTab(searchParams)
  )
  const [mountedTabs, setMountedTabs] = useState<Set<PatchTabKey>>(
    () => new Set([selected])
  )

  useEffect(() => {
    const nextTab = getSelectedTab(searchParams)
    setSelected(nextTab)
    setMountedTabs((current) => {
      if (current.has(nextTab)) {
        return current
      }
      const next = new Set(current)
      next.add(nextTab)
      return next
    })

    if (hasTabDeepLink(searchParams)) {
      requestAnimationFrame(() => {
        tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [searchParams])

  const handleSelectionChange = (value: Key) => {
    const nextTab = value.toString()
    if (!isPatchTabKey(nextTab)) {
      return
    }

    setSelected(nextTab)
    setMountedTabs((current) => {
      if (current.has(nextTab)) {
        return current
      }
      const next = new Set(current)
      next.add(nextTab)
      return next
    })

    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)
    if (nextTab !== 'comments') {
      params.delete('commentId')
    }
    if (nextTab !== 'rating') {
      params.delete('ratingId')
    }
    if (nextTab !== 'resources') {
      params.delete('resourceId')
      params.delete('resourceSection')
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false
    })
  }

  return (
    <div ref={tabsRef} id="patch-detail-tabs">
      <Tabs
        className="w-full my-6 overflow-hidden shadow-medium rounded-large"
        fullWidth={true}
        defaultSelectedKey="introduction"
        onSelectionChange={handleSelectionChange}
        selectedKey={selected}
      >
        <Tab key="introduction" title="游戏信息" className="p-0 min-w-20">
          <IntroductionTab intro={intro} patchId={Number(id)} uid={uid} />
        </Tab>

        <Tab key="resources" title="资源链接" className="p-0 min-w-20">
          {mountedTabs.has('resources') && (
            <ResourceTab id={id} vndbId={vndbId} />
          )}
        </Tab>

        <Tab key="comments" title="讨论版" className="p-0 min-w-20">
          {mountedTabs.has('comments') && <CommentTab id={id} />}
        </Tab>

        <Tab key="rating" title="游戏评价" className="p-0 min-w-20">
          {mountedTabs.has('rating') && <RatingTab id={id} />}
        </Tab>
      </Tabs>
    </div>
  )
}
