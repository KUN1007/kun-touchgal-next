'use client'

import { useLayoutEffect } from 'react'
import { useBreadcrumbStore } from '~/store/breadcrumb'

interface Props {
  routeKey: string
  title: string
}

export const KunBreadcrumbTitle = ({ routeKey, title }: Props) => {
  const setTitle = useBreadcrumbStore((state) => state.setTitle)
  const clearTitle = useBreadcrumbStore((state) => state.clearTitle)

  useLayoutEffect(() => {
    setTitle(routeKey, title)

    return () => {
      clearTitle(routeKey)
    }
  }, [clearTitle, routeKey, setTitle, title])

  return null
}
