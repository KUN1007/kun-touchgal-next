'use client'

import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  Link,
  useDisclosure
} from '@heroui/react'
import { KunTreeNode } from '~/lib/mdx/types'
import { BookOpen, X } from 'lucide-react'
import { SidebarContent } from './SidebarContent'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '~/utils/cn'
import { usePrioritizedWheelScroll } from './usePrioritizedWheelScroll'

interface Props {
  tree: KunTreeNode
}

export const KunSidebar = ({ tree }: Props) => {
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure()
  const pathname = usePathname()
  const { containerRef: sidebarRef, scrollContainerRef } =
    usePrioritizedWheelScroll<HTMLElement, HTMLDivElement>()
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => onClose(), [onClose, pathname])

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 400)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <aside
        ref={sidebarRef}
        className="kun-scroll-nav sticky top-20 hidden h-[calc(100dvh-6rem)] w-64 shrink-0 self-start md:block"
      >
        <div className="flex h-full flex-col overflow-hidden rounded-[22px] border border-default-200/60 bg-background shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:bg-content1 dark:shadow-[0_12px_32px_rgba(0,0,0,0.15)]">
          <Link
            color="foreground"
            href="/doc"
            className="mx-3 mt-3 flex min-h-12 items-center gap-2 rounded-2xl bg-primary-500/10 px-3 text-lg font-semibold"
          >
            <BookOpen className="size-5 text-primary-500" />
            <span>帮助文档</span>
          </Link>
          <div
            ref={scrollContainerRef}
            className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3 scrollbar-hide"
          >
            <SidebarContent tree={tree} />
          </div>
        </div>
      </aside>

      <div className="contents md:hidden">
        <Button
          aria-label="打开文档目录"
          className={cn(
            'fixed bottom-12 right-6 z-20 h-11 gap-1.5 rounded-full px-4 shadow-lg transition-[bottom] duration-300 motion-reduce:transition-none md:hidden',
            showBackToTop && 'bottom-28'
          )}
          color="primary"
          variant="flat"
          startContent={<BookOpen className="size-4" />}
          onPress={onOpen}
        >
          目录
        </Button>

        <Drawer
          hideCloseButton
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          placement="left"
          size="xs"
        >
          <DrawerContent className="m-3 h-[calc(100dvh-1.5rem)] overflow-hidden rounded-[22px] border border-default-200/60 bg-background shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:bg-content1 dark:shadow-[0_12px_32px_rgba(0,0,0,0.15)]">
            <DrawerHeader className="p-0">
              <div className="mx-3 mt-3 flex min-h-12 flex-1 items-center gap-2 rounded-2xl bg-primary-500/10 px-3">
                <Link
                  color="foreground"
                  href="/doc"
                  className="flex min-w-0 flex-1 items-center gap-2 text-lg font-semibold"
                >
                  <BookOpen className="size-5 shrink-0 text-primary-500" />
                  <span>帮助文档</span>
                </Link>
                <Button
                  isIconOnly
                  aria-label="关闭文档目录"
                  className="size-8 min-w-8 shrink-0"
                  radius="full"
                  variant="light"
                  onPress={onClose}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </DrawerHeader>
            <DrawerBody className="min-h-0 px-3 pb-4 pt-3 scrollbar-hide">
              <SidebarContent tree={tree} />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  )
}
