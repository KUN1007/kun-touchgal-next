'use client'

import { memo, useState } from 'react'
import { Card, CardBody } from '@heroui/card'
import { Image } from '@heroui/image'
import Link from 'next/link'
import { Eye, Star, StarOff } from 'lucide-react'
import { formatNumber } from '~/utils/formatNumber'
import { cn } from '~/utils/cn'
import { kunCjkIndentClass } from '~/utils/kunCjkIndent'

const CARD_ATTRIBUTE_STYLE_MAP: Record<string, string> = {
  PC: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200',
  PE: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200',
  中文: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200'
}

const CARD_CLASS_NAME =
  'group flex h-full w-full flex-col overflow-hidden rounded-[22px] border border-default-200/60 bg-background shadow-[0_12px_32px_rgba(15,23,42,0.05)] transition-[box-shadow,transform,scale] duration-300 hover:shadow-[0_16px_42px_rgba(15,23,42,0.08)] motion-reduce:transition-none dark:bg-content1 dark:shadow-[0_12px_32px_rgba(0,0,0,0.15)]'

const IMAGE_LOADED_CLASS_NAME =
  'size-full object-cover duration-500 opacity-100 transition-opacity'
const IMAGE_LOADING_CLASS_NAME =
  'size-full object-cover duration-500 opacity-0 transition-opacity'

const getCardAttributeLabels = (patch: GalgameCard) => {
  const labels: string[] = []

  if (patch.type.includes('pc')) {
    labels.push('PC')
  }

  if (patch.type.includes('mobile')) {
    labels.push('PE')
  }

  if (patch.type.includes('chinese')) {
    labels.push('中文')
  }

  return labels
}

const hasRating = (rating?: number): rating is number =>
  typeof rating === 'number' && rating > 0

const getRatingText = (rating: number) => {
  return Number.isInteger(rating) ? rating.toString() : rating.toFixed(1)
}

interface Props {
  patch: GalgameCard
  openOnNewTab?: boolean
}

export const GalgameCard = memo(function GalgameCard({
  patch,
  openOnNewTab = true
}: Props) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const attributeLabels = getCardAttributeLabels(patch)
  const averageRating = patch.averageRating
  const ratingText = hasRating(averageRating)
    ? getRatingText(averageRating)
    : null

  return (
    <Card
      isPressable
      as={Link}
      href={`/${patch.uniqueId}`}
      target={openOnNewTab ? '_blank' : '_self'}
      rel={openOnNewTab ? 'noopener noreferrer' : undefined}
      className={CARD_CLASS_NAME}
    >
      <div className="relative w-full overflow-hidden bg-default-100">
        <div
          className={cn(
            'absolute inset-0 animate-pulse bg-default-200',
            imageLoaded ? 'opacity-0' : 'opacity-100',
            'transition-opacity duration-300'
          )}
          style={{ aspectRatio: '16/9' }}
        />
        <Image
          radius="none"
          alt={patch.name}
          className={
            imageLoaded ? IMAGE_LOADED_CLASS_NAME : IMAGE_LOADING_CLASS_NAME
          }
          removeWrapper={true}
          src={
            patch.banner
              ? patch.banner.replace(/\.avif$/, '-mini.avif')
              : '/touchgal.avif'
          }
          style={{ aspectRatio: '16/9' }}
          onLoad={() => setImageLoaded(true)}
        />
      </div>

      <CardBody className="flex flex-1 flex-col gap-2 p-3 sm:gap-3 sm:p-4">
        <h2
          className={cn(
            'text-base font-bold leading-tight tracking-wide text-foreground transition-colors line-clamp-2 sm:text-lg group-hover:text-primary-500',
            kunCjkIndentClass(patch.name)
          )}
        >
          {patch.name}
        </h2>

        <div className="mt-auto space-y-2 sm:space-y-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {ratingText ? (
                <Star
                  aria-hidden="true"
                  className="size-4 fill-warning-400 text-warning-400"
                />
              ) : (
                <StarOff
                  aria-hidden="true"
                  className="size-3.5 text-default-500"
                />
              )}
              {ratingText && (
                <span className="font-extrabold text-foreground">
                  <span className="sr-only">评分 </span>
                  {ratingText}
                </span>
              )}
            </div>

            <div className="h-4 w-px bg-default-200" />

            <div className="flex items-center gap-1.5 text-default-500 sm:gap-2">
              <Eye aria-hidden="true" className="size-4" />
              <span>
                <span className="sr-only">浏览量 </span>
                {formatNumber(patch.view)}
              </span>
            </div>
          </div>

          <div className="flex min-h-5 flex-wrap gap-1.5 pt-0.5 sm:min-h-6">
            {attributeLabels.map((label) => (
              <span
                key={label}
                className={cn(
                  'inline-flex h-5 w-8 items-center justify-center rounded-lg text-[11px] font-semibold leading-none sm:h-6 sm:w-11 sm:text-xs',
                  CARD_ATTRIBUTE_STYLE_MAP[label]
                )}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  )
})
