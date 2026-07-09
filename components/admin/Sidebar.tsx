'use client'

import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  Link,
  useDisclosure
} from '@heroui/react'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { SidebarContent } from './SidebarContent'
import { useEffect } from 'react'

export const Sidebar = () => {
  const pathname = usePathname()
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure()

  useEffect(() => onClose(), [pathname])

  return (
    <>
      <aside className="fixed z-20 hidden w-64 h-full border-r md:block md:static bg-background border-divider">
        <div className="flex flex-col size-full">
          <Link
            color="foreground"
            href="/admin"
            className="my-4 text-xl font-bold"
          >
            管理面板
          </Link>
          {SidebarContent({ pathname })}
        </div>
      </aside>

      <button
        type="button"
        aria-label="打开管理菜单"
        className="fixed top-0 left-0 flex items-center h-full cursor-pointer text-default-500 md:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={() => onOpen()}
      >
        <ChevronRight size={24} />
      </button>

      <Drawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        placement="left"
        size="xs"
      >
        <DrawerContent>
          <DrawerHeader className="flex flex-col gap-1">管理面板</DrawerHeader>
          <DrawerBody>{SidebarContent({ pathname })}</DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
}
