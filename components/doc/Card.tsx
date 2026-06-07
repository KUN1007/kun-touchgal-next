'use client'

import { useState } from 'react'
import { Card, CardBody, CardFooter } from '@heroui/react'
import { ArrowRight, Calendar, Type } from 'lucide-react'
import { Image } from '@heroui/image'
import { KunPostMetadata } from '~/lib/mdx/types'
import { formatTimeDifference } from '~/utils/time'
import Link from 'next/link'

interface Props {
  post: KunPostMetadata
}

export const KunAboutCard = ({ post }: Props) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const textCount = Math.max(post.textCount, 0)

  return (
    <Card
      isPressable
      as={Link}
      href={`/doc/${post.slug}`}
      className="group w-full overflow-hidden border border-default-200/70 bg-content1/80 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none"
    >
      <CardBody className="p-0">
        <div
          className="relative w-full overflow-hidden bg-default-100"
          style={{ aspectRatio: '16/9' }}
        >
          <div
            className={`absolute inset-0 animate-pulse bg-default-100 ${
              imageLoaded ? 'opacity-0' : 'opacity-90'
            } transition-opacity duration-300`}
          />
          <Image
            removeWrapper
            radius="none"
            alt={post.title}
            className={`absolute inset-0 block size-full object-cover transition-all duration-300 group-hover:scale-105 ${
              imageLoaded ? 'scale-100 opacity-95' : 'scale-105 opacity-0'
            }`}
            loading="lazy"
            src={post.banner}
            onLoad={() => setImageLoaded(true)}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        </div>

        <div className="space-y-3 p-4">
          <h2 className="text-lg font-bold leading-snug transition-colors line-clamp-2 group-hover:text-primary-500">
            {post.title}
          </h2>
          {post.description && (
            <p className="text-sm leading-6 text-default-500 line-clamp-3">
              {post.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-sm text-default-500">
            <div className="flex items-center gap-1.5">
              <Calendar className="size-4 text-primary-400" />
              <time>{formatTimeDifference(post.date)}</time>
            </div>
            <div className="flex items-center gap-1.5">
              <Type className="size-4 text-secondary-400" />
              <span>{textCount} 字</span>
            </div>
          </div>
        </div>
      </CardBody>
      <CardFooter className="justify-between border-t border-default-200/70 bg-default-50/60 px-4 py-3 dark:bg-default-100/10">
        <span className="text-sm font-medium text-default-600">阅读文档</span>
        <ArrowRight className="size-4 text-primary-500 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </CardFooter>
    </Card>
  )
}
