'use client'

import { useEffect, useState } from 'react'
import {
  Navbar,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle
} from '@heroui/navbar'
import Link from 'next/link'
import { KunTopBarBrand } from './Brand'
import { KunTopBarUser } from './User'
import { usePathname } from 'next/navigation'
import { kunNavItem } from '~/constants/top-bar'
import { KunMobileMenu } from './KunMobileMenu'

export const KunTopBar = () => {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  return (
    <Navbar
      maxWidth="xl"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      classNames={{ wrapper: 'px-3 sm:px-6' }}
    >
      <NavbarContent className="sm:hidden" justify="start">
        <li className="h-full">
          <NavbarMenuToggle />
        </li>
      </NavbarContent>

      <div className="flex items-center gap-2">
        <KunTopBarBrand />

        <NavbarContent className="hidden gap-3 sm:flex">
          {kunNavItem.map((item) => (
            <NavbarItem key={item.href} isActive={pathname === item.href}>
              <Link
                className={
                  pathname === item.href ? 'text-primary' : 'text-foreground'
                }
                href={item.href}
              >
                {item.name}
              </Link>
            </NavbarItem>
          ))}
        </NavbarContent>
      </div>

      <KunTopBarUser />

      <KunMobileMenu />
    </Navbar>
  )
}
