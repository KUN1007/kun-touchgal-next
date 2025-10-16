'use client'

import { useState } from 'react'
import { Card, CardBody, CardFooter, CardHeader } from '@heroui/card'
import { Image } from '@heroui/image'
import { KunCardStats } from '~/components/kun/CardStats'
import Link from 'next/link'
import { KunPatchAttribute } from '~/components/kun/PatchAttribute'
import { cn } from '~/utils/cn'
import { SUPPORTED_TYPE_MAP } from '~/constants/resource'
import { Chip } from '@heroui/react'
import { Star } from 'lucide-react'

interface Props {
  patch: GalgameCard
  openOnNewTab?: boolean
}

export const GalgameCard = ({ patch, openOnNewTab = true }: Props) => {
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <Card
      isPressable
      as={Link}
      href={`/${patch.uniqueId}`}
      target={openOnNewTab ? '_blank' : '_self'}
      className="w-full border border-default-100 dark:border-default-200"
    >
      <CardHeader className="p-0">
        <div className="relative w-full mx-auto overflow-hidden text-center rounded-t-lg opacity-90">
          <div
            className={cn(
              'absolute inset-0 animate-pulse bg-default-100',
              imageLoaded ? 'opacity-0' : 'opacity-90',
              'transition-opacity duration-300'
            )}
            style={{ aspectRatio: '16/9' }}
          />
          <Image
            radius="none"
            alt={patch.name}
            className={cn(
              'size-full object-cover transition-all duration-300 relative',
              imageLoaded ? 'scale-100 opacity-90' : 'scale-105 opacity-0'
            )}
            removeWrapper={true}
            src={
              patch.banner
                ? patch.banner.replace(/\.avif$/, '-mini.avif')
                : '/touchgal.avif'
            }
            style={{ aspectRatio: '16/9' }}
            onLoad={() => setImageLoaded(true)}
          />

          <div className="absolute w-full py-1 px-3 bg-white/60 dark:bg-black/40 bottom-0 z-10">
            <KunCardStats
              patch={patch}
              isMobile={true}
              className="text-black dark:text-white"
            />
          </div>

          {patch.averageRating !== 0 && (
            <span className="flex bg-background/50 px-2 rounded-xl items-center gap-1 absolute top-2 right-2 z-10">
              <Star className="size-4 text-warning" fill="#F5A524" />
              <span>{patch.averageRating}</span>
            </span>
          )}
        </div>
      </CardHeader>
      <CardBody className="justify-between space-y-2">
        <h2 className="transition-colors text-small sm:text-lg line-clamp-2 hover:text-primary-500">
          {patch.name}
        </h2>
      </CardBody>
      <CardFooter className="pt-0">
        <div className="flex flex-wrap gap-2">
          {patch.type.map((t) => (
            <span
              className="px-2 py-0.5 bg-primary/20 text-primary rounded-xl text-xs"
              key={t}
            >
              {SUPPORTED_TYPE_MAP[t]}
            </span>
          ))}
        </div>
      </CardFooter>
    </Card>
  )
}
