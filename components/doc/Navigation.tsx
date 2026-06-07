'use client'

import { KunPostMetadata } from '~/lib/mdx/types'
import { Button } from '@heroui/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface NavigationProps {
  prev: KunPostMetadata | null
  next: KunPostMetadata | null
}

export const KunBottomNavigation = ({ prev, next }: NavigationProps) => {
  return (
    <nav
      aria-label="文档分页"
      className="grid gap-3 border-t border-default-200/70 pt-6 sm:grid-cols-2"
    >
      {prev ? (
        <Button
          variant="flat"
          color="primary"
          as={Link}
          href={`/doc/${prev.slug}`}
          startContent={<ChevronLeft className="size-4 shrink-0" />}
          className="h-auto min-h-16 justify-start rounded-2xl px-4 py-3"
        >
          <span className="min-w-0 text-left">
            <span className="block text-xs text-default-500">上一篇</span>
            <span className="mt-1 block font-medium line-clamp-2">
              {prev.title}
            </span>
          </span>
        </Button>
      ) : (
        <div className="hidden sm:block" />
      )}

      {next ? (
        <Button
          as={Link}
          href={`/doc/${next.slug}`}
          variant="flat"
          color="secondary"
          endContent={<ChevronRight className="size-4 shrink-0" />}
          className="h-auto min-h-16 justify-end rounded-2xl px-4 py-3"
        >
          <span className="min-w-0 text-right">
            <span className="block text-xs text-default-500">下一篇</span>
            <span className="mt-1 block font-medium line-clamp-2">
              {next.title}
            </span>
          </span>
        </Button>
      ) : (
        <div className="hidden sm:block" />
      )}
    </nav>
  )
}
