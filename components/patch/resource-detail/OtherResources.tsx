'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { KunTimeAgo } from '~/components/kun/TimeAgo'
import { getResourcePageTitle } from '~/utils/patch/getResourcePageTitle'
import type { RefObject } from 'react'
import type { ResourceDetailOther } from '~/app/api/patch/resource/detail'

interface Props {
  resources: ResourceDetailOther[]
  patchUniqueId: string
  mainColumnRef: RefObject<HTMLDivElement | null>
}

// SSR 初始条数, 也是窄屏(单栏布局)下的固定条数
const DEFAULT_VISIBLE_COUNT = 3

export const OtherResources = ({
  resources,
  patchUniqueId,
  mainColumnRef
}: Props) => {
  const listRef = useRef<HTMLUListElement>(null)
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(DEFAULT_VISIBLE_COUNT, resources.length)
  )

  // 双栏布局下按主内容列的剩余高度动态调整条数, 避免侧边栏长于主内容;
  // 列表项结构固定等高, 以首项高度推算可容纳条数
  useLayoutEffect(() => {
    const main = mainColumnRef.current
    const list = listRef.current
    if (!main || !list) {
      return
    }

    const compute = () => {
      if (!window.matchMedia('(min-width: 1024px)').matches) {
        setVisibleCount(Math.min(DEFAULT_VISIBLE_COUNT, resources.length))
        return
      }
      const firstItem = list.children[0] as HTMLElement | undefined
      if (!firstItem?.offsetHeight) {
        return
      }
      const gap = parseFloat(getComputedStyle(list).rowGap) || 0
      const available =
        main.getBoundingClientRect().bottom - list.getBoundingClientRect().top
      const count = Math.floor(
        (available + gap) / (firstItem.offsetHeight + gap)
      )
      setVisibleCount(Math.min(resources.length, Math.max(1, count)))
    }

    compute()
    const observer = new ResizeObserver(compute)
    observer.observe(main)
    return () => observer.disconnect()
  }, [mainColumnRef, resources.length])

  if (!resources.length) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start">
        <h2 className="text-lg font-semibold">相关资源</h2>
      </CardHeader>
      <CardBody className="pt-0">
        <ul ref={listRef} className="flex flex-col gap-2">
          {resources.slice(0, visibleCount).map((item) => (
            <li key={item.id}>
              <Link
                href={`/${patchUniqueId}/resource/${item.id}`}
                className="block rounded-large border border-default-200 p-3 transition-colors hover:border-primary-300 hover:bg-default-100"
              >
                <p className="line-clamp-1 break-all text-sm font-medium">
                  {getResourcePageTitle(item)}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-default-500">
                  {item.user.name} ·{' '}
                  <KunTimeAgo date={item.created} maxRelativeDays={7} />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}
