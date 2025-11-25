'use client'

import { Card, Chip, Link } from '@heroui/react'
import { docDirectoryLabelMap } from '~/constants/doc'
import { formatTimeDifference } from '~/utils/time'
import type { HomeCarouselMetadata } from './mdx'

interface Props {
  posts: HomeCarouselMetadata[]
  currentSlide: number
}

export const KunDesktopCard = ({ posts, currentSlide }: Props) => {
  const post = posts[currentSlide]

  return (
    <div className="hidden h-full sm:block group">
      <img
        alt={post.title}
        className="object-cover w-full h-full brightness-75 rounded-2xl"
        src={post.banner}
      />
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/30 via-black/10 to-transparent" />

      <Card className="absolute border-none bottom-4 left-4 right-4 bg-background/80 backdrop-blur-md">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <img
              src={post.authorAvatar}
              alt={post.authorName}
              className="w-6 h-6 rounded-full"
            />
            <span className="text-sm text-foreground/80">
              {post.authorName}
            </span>
          </div>
          <Link
            color="foreground"
            className="mb-2 text-2xl font-bold hover:text-primary-500 line-clamp-1"
            href={post.link}
          >
            <h1>{post.title}</h1>
          </Link>

          <p className="mb-2 text-sm text-foreground/80 line-clamp-1">
            {post.description}
          </p>
          <div className="flex flex-wrap gap-2">
            <Chip variant="flat" size="sm" color="primary">
              {docDirectoryLabelMap[post.directory]}
            </Chip>

            <Chip variant="flat" size="sm">
              {formatTimeDifference(post.date)}
            </Chip>
          </div>
        </div>
      </Card>
    </div>
  )
}
