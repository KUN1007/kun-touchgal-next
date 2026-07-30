'use client'

import { Button } from '@heroui/button'
import Link from 'next/link'
import type { ButtonProps } from '@heroui/button'

// Server Component 中不能写 as={Link} (函数 prop 无法跨 RSC 边界序列化),
// 需要链接式按钮时使用本封装; props 用白名单以避免函数 prop 再次穿越边界
interface Props extends Pick<
  ButtonProps,
  | 'variant'
  | 'color'
  | 'size'
  | 'radius'
  | 'fullWidth'
  | 'isDisabled'
  | 'startContent'
  | 'endContent'
  | 'className'
  | 'children'
> {
  href: string
}

export const KunLinkButton = ({ href, ...props }: Props) => {
  return <Button {...props} as={Link} href={href} />
}
