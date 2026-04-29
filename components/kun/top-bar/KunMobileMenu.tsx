'use client'

import { NavbarMenu, NavbarMenuItem } from '@heroui/navbar'
import Link from 'next/link'
import Image from 'next/image'
import { kunMoyuMoe } from '~/config/moyu-moe'
import { kunMobileNavItem } from '~/constants/top-bar'

export const KunMobileMenu = () => {
  return (
    <NavbarMenu className="space-y-4">
      <NavbarMenuItem>
        <Link className="flex items-center" href="/">
          <Image
            src="/logo.webp"
            alt=""
            width={50}
            height={50}
            priority
          />
          <p className="ml-4 mr-2 text-3xl font-bold">
            {kunMoyuMoe.creator.name}
          </p>
        </Link>
      </NavbarMenuItem>

      {kunMobileNavItem.map((item, index) => (
        <NavbarMenuItem key={index}>
          <Link className="w-full font-semibold" href={item.href}>
            {item.name}
          </Link>
        </NavbarMenuItem>
      ))}
    </NavbarMenu>
  )
}
