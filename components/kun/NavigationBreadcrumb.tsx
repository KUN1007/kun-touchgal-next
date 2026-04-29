'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import {
  createBreadcrumbItem,
  getBreadcrumbTitleKey
} from '~/constants/routes/routes'
import { initialBreadcrumbItems, useBreadcrumbStore } from '~/store/breadcrumb'

export const KunNavigationBreadcrumb = () => {
  const pathname = usePathname()
  const params = useParams()
  const titleKey = getBreadcrumbTitleKey(pathname, params)
  const pageTitle = useBreadcrumbStore((state) => state.titles[titleKey])
  const items = [
    ...initialBreadcrumbItems,
    ...createBreadcrumbItem(pathname, params, pageTitle)
  ]

  const hideBreadcrumbRoutes = [
    '/',
    '/edit/create',
    '/edit/rewrite',
    '/redirect',
    '/friend-link'
  ]

  if (hideBreadcrumbRoutes.includes(pathname)) {
    return null
  }

  return (
    <div className="w-full my-4 bg-background/60 backdrop-blur-lg">
      <nav aria-label="Breadcrumb" className="px-3 mx-auto sm:px-6 max-w-7xl">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-foreground/60">
          {items.map((item, index) => {
            const isCurrent = index === items.length - 1

            return (
              <li key={item.key} className="flex min-w-0 items-center gap-1">
                {index > 0 && (
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-foreground/40"
                  />
                )}

                {isCurrent ? (
                  <span
                    aria-current="page"
                    className="min-w-0 break-all text-foreground"
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    className="min-w-0 break-all transition-colors hover:text-foreground"
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}
