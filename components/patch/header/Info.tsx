'use client'

import { Card, CardBody } from '@heroui/card'
import { Divider } from '@heroui/divider'
import { Chip, Tooltip } from '@heroui/react'
import { KunCardStats } from '~/components/kun/CardStats'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import { formatDistanceToNow } from '~/utils/formatDistanceToNow'
import {
  GALGAME_AGE_LIMIT_DETAIL,
  GALGAME_AGE_LIMIT_MAP
} from '~/constants/galgame'
import { PatchHeaderActions } from './Actions'
import { Tags } from './Tags'
import Image from 'next/image'
import { EditBanner } from './EditBanner'
import { PatchRatingSummaryBadge } from './RatingSummaryBadge'
import type { Patch } from '~/types/api/patch'

interface PatchHeaderInfoProps {
  patch: Patch
  handleClickDownloadNav: () => void
}

export const PatchHeaderInfo = ({
  patch,
  handleClickDownloadNav
}: PatchHeaderInfoProps) => {
  return (
    <Card>
      <CardBody className="p-0">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative w-full h-full overflow-hidden md:col-span-1 aspect-video md:rounded-l-xl">
            <Image
              src={patch.banner}
              alt={patch.name}
              className="object-cover"
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              priority
              unoptimized
            />

            <EditBanner patch={patch} />
          </div>

          <div className="flex flex-col gap-4 p-6 md:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                {patch.name}
              </h1>
              <Tooltip content={GALGAME_AGE_LIMIT_DETAIL[patch.contentLimit]}>
                <Chip
                  color={patch.contentLimit === 'sfw' ? 'success' : 'danger'}
                  variant="flat"
                >
                  {GALGAME_AGE_LIMIT_MAP[patch.contentLimit]}
                </Chip>
              </Tooltip>
            </div>

            <PatchRatingSummaryBadge patch={patch} />

            <div className="flex flex-wrap gap-2">
              <Tags patch={patch} />
            </div>

            <PatchHeaderActions
              patch={patch}
              handleClickDownloadNav={handleClickDownloadNav}
            />

            <Divider />

            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <KunUser
                user={patch.user}
                userProps={{
                  name: `${patch.user.name} - ${formatDistanceToNow(patch.created)}`,
                  avatarProps: {
                    showFallback: true,
                    name: patch.user.name.charAt(0).toUpperCase(),
                    src: patch.user.avatar,
                    size: 'sm',
                    className: 'border border-border/30'
                  }
                }}
              />
              <KunCardStats
                patch={patch}
                disableTooltip={false}
                isMobile={false}
              />
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
