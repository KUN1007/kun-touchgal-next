'use client'

import { Card, Link } from '@heroui/react'
import type { HomeCarouselMetadata } from './mdx'

interface Props {
  posts: readonly HomeCarouselMetadata[]
  currentSlide: number
}

export const KunMobileCard = ({ posts, currentSlide }: Props) => {
  const post = posts[currentSlide]

  if (!post) {
    return null
  }

  return (
    <Card className="h-[200px] bg-transparent border-none shadow-none">
      <div className="relative">
        <img
          alt={post.title}
          className="object-cover w-full rounded-2xl h-[200px]"
          src={post.banner}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-2xl" />

        <div className="absolute inset-0 flex flex-col justify-end p-4 space-y-2">
          <Link
            color="foreground"
            className="text-lg font-bold text-white hover:text-primary-500 line-clamp-1"
            href={post.link}
          >
            <h1>{post.title}</h1>
          </Link>

          <p className="mb-4 text-xs text-white/80 line-clamp-2">
            {post.description}
          </p>
        </div>
      </div>
    </Card>
  )
}
