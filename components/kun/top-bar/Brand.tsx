import { NavbarBrand } from '@heroui/navbar'
import { kunMoyuMoe } from '~/config/moyu-moe'
import Image from 'next/image'
import Link from 'next/link'

export const KunTopBarBrand = () => {
  return (
    <NavbarBrand className="hidden md:flex">
      <Link className="flex items-center" href="/">
        <Image
          src="/favicon.webp"
          alt={kunMoyuMoe.titleShort}
          width={32}
          height={32}
          priority
          className="shrink-0"
        />
        <p className="ml-4 mr-2 font-bold text-inherit">
          {kunMoyuMoe.creator.name}
        </p>
      </Link>
    </NavbarBrand>
  )
}
