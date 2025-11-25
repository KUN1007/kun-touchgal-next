'use client'

import { useState } from 'react'
import { Card, CardBody, CardFooter } from '@heroui/react'
import { Calendar, Type } from 'lucide-react'
import { Image } from '@heroui/image'
import { KunPostMetadata } from '~/lib/mdx/types'
import { formatTimeDifference } from '~/utils/time'
import Link from 'next/link'

interface Props {
  post: KunPostMetadata
}

export const KunAboutCard = ({ post }: Props) => {
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <Card
      isPressable
      as={Link}
      href={`/doc/${post.slug}`}
      className="w-full transition-transform duration-200 hover:scale-[1.02]"
    >
      <CardBody className="p-4 space-y-3">
        <h2 className="mb-2 text-xl font-bold">{post.title}</h2>
        <div className="relative w-full mx-auto overflow-hidden text-center rounded-t-lg opacity-90">
          <div
            className={`absolute inset-0 animate-pulse bg-default-100 ${
              imageLoaded ? 'opacity-0' : 'opacity-90'
            } transition-opacity duration-300`}
            style={{ aspectRatio: '16/9' }}
          />
          <Image
            alt={post.title}
            className={`size-full object-cover transition-all duration-300 ${
              imageLoaded ? 'scale-100 opacity-90' : 'scale-105 opacity-0'
            }`}
            src={post.banner}
            style={{ aspectRatio: '16/9' }}
            onLoad={() => setImageLoaded(true)}
          />
        </div>
        <div className="flex items-center gap-4 text-sm text-default-500">
          <div className="flex items-center gap-1">
            <Calendar size={16} />
            <time>{formatTimeDifference(post.date)}</time>
          </div>
          <div className="flex items-center gap-1">
            <Type size={16} />
            <span>{post.textCount} 字</span>
          </div>
        </div>
      </CardBody>
      <CardFooter className="px-5 py-3 border-t border-default-200 bg-default-50">
        <span className="text-sm text-default-600">点击阅读更多 →</span>
      </CardFooter>
    </Card>
  )
}
