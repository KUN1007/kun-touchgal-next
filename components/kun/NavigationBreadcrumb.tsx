'use client'

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger
} from '@heroui/react'
import { BreadcrumbItem, Breadcrumbs } from '@heroui/breadcrumbs'
import { ChevronRight } from 'lucide-react'
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

  return (
    <>
      {!hideBreadcrumbRoutes.includes(pathname) && (
        <div className="w-full my-4 bg-background/60 backdrop-blur-lg">
          <div className="px-3 mx-auto sm:px-6 max-w-7xl">
            <Breadcrumbs
              underline="hover"
              separator={<ChevronRight className="size-4" />}
              itemClasses={{
                item: 'text-foreground/60 data-[current=true]:text-foreground'
              }}
              variant="light"
              radius="lg"
              renderEllipsis={({ items, ellipsisIcon, separator }) => (
                <div key="id" className="flex items-center">
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        isIconOnly
                        className="size-6 min-w-6"
                        size="sm"
                        variant="flat"
                      >
                        {ellipsisIcon}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Routes">
                      {items.map((item, index) => (
                        <DropdownItem
                          key={index}
                          textValue={index.toString()}
                          href={item.href}
                        >
                          <p className="break-all">{item.children}</p>
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                  {separator}
                </div>
              )}
            >
              {items.map((item, index) => (
                <BreadcrumbItem
                  key={item.key}
                  isCurrent={index === items.length - 1}
                  href={item.href}
                  classNames={{
                    item: 'break-all whitespace-normal'
                  }}
                >
                  {item.label}
                </BreadcrumbItem>
              ))}
            </Breadcrumbs>
          </div>
        </div>
      )}
    </>
  )
}
