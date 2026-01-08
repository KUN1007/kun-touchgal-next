'use client'

import { Button, Link } from '@heroui/react'
import { homeNavigationItems } from '~/constants/home'

interface Props {
  buttonSize: 'sm' | 'md' | 'lg'
}

export const KunHomeNavigationItems = ({ buttonSize }: Props) => {
  return (
    <>
      {homeNavigationItems.map((item) => (
        <Button
          key={item.label}
          as={Link}
          href={item.href}
          startContent={<item.icon className="w-5 h-5" />}
          className="w-full shadow-md opacity-70"
          color={item.color}
          variant="flat"
          size={buttonSize}
          isExternal={item.isExternal}
        >
          {item.label}
        </Button>
      ))}
    </>
  )
}
