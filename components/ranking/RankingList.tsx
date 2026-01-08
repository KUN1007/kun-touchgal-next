'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Card } from '@heroui/react'
import { formatNumber } from '~/utils/formatNumber'
import { KunCardStats } from '~/components/kun/CardStats'
import { cn } from '~/utils/cn'
import type { RankingCard } from '~/types/api/ranking'

interface Props {
  galgames: RankingCard[]
  page: number
  pageSize: number
}

export const RankingList = ({ galgames, page, pageSize }: Props) => {
  const startRank = (page - 1) * pageSize

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
        {galgames.map((patch, index) => {
          const rank = startRank + index + 1
          const rating =
            patch.averageRating && patch.averageRating > 0
              ? patch.averageRating.toFixed(1)
              : '--'

          return (
            <Card
              key={patch.id}
              as={Link}
              isPressable
              href={`/${patch.uniqueId}`}
            >
              <div className="relative w-full overflow-hidden">
                <div className="relative aspect-video">
                  <Image
                    src={
                      patch.banner
                        ? patch.banner.replace(/\.avif$/, '-mini.avif')
                        : '/touchgal.avif'
                    }
                    alt={patch.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 25vw"
                    className="object-cover opacity-90 transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40" />
                </div>

                <div
                  className={cn(
                    'bg-background/80 rounded-lg aspect-square flex items-center px-2 absolute top-3 left-3',
                    rank > 99 ? 'text-xs' : rank > 9 ? 'text-sm' : 'text-base'
                  )}
                >
                  {rank}
                </div>

                <div className="absolute right-3 top-3 text-right text-xs text-white">
                  <p className="text-lg text-warning-500 font-bold">{rating}</p>
                  <p className="opacity-80">
                    {formatNumber(patch.ratingCount)} 人评分
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-3">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground line-clamp-2">
                    {patch.name}
                  </h3>
                  <p className="text-xs text-default-500 line-clamp-1">
                    {patch.tags.length ? patch.tags.join(' / ') : '暂无标签'}
                  </p>
                </div>

                <KunCardStats patch={patch} disableTooltip isMobile />
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
