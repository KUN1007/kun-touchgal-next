import { Download, Eye, Heart, MessageSquare, Puzzle } from 'lucide-react'
import type { ReactNode } from 'react'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import { formatTimeDifference } from '~/utils/time'
import { formatNumber } from '~/utils/formatNumber'
import {
  GALGAME_AGE_LIMIT_DETAIL,
  GALGAME_AGE_LIMIT_MAP
} from '~/constants/galgame'
import { PatchHeaderActions } from './Actions'
import { Tags } from './Tags'
import { EditBanner } from './EditBanner'
import { BannerImage } from './BannerImage'
import { PatchRatingSummaryBadge } from './RatingSummaryBadge'
import type { Patch } from '~/types/api/patch'

interface PatchHeaderInfoProps {
  patch: Patch
}

const StatItem = ({
  title,
  value,
  children
}: {
  title: string
  value: number
  children: ReactNode
}) => (
  <div className="flex items-center gap-1" title={title}>
    {children}
    <span>{formatNumber(value)}</span>
  </div>
)

const PatchStats = ({ patch }: { patch: Patch }) => (
  <div className="flex space-x-2 justify-between text-sm sm:space-x-4 text-default-500">
    <StatItem title="浏览数" value={patch.view}>
      <Eye className="size-4" />
    </StatItem>
    <StatItem title="下载数" value={patch.download}>
      <Download className="size-4" />
    </StatItem>
    <StatItem title="收藏数" value={patch._count.favorite_folder || 0}>
      <Heart className="size-4" />
    </StatItem>
    <StatItem title="下载资源数" value={patch._count.resource || 0}>
      <Puzzle className="size-4" />
    </StatItem>
    <StatItem title="评论数" value={patch._count.comment || 0}>
      <MessageSquare className="size-4" />
    </StatItem>
  </div>
)

export const PatchHeaderInfo = ({ patch }: PatchHeaderInfoProps) => {
  return (
    <div className="bg-content1 text-content1-foreground shadow-medium rounded-large">
      <div className="p-0">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative w-full h-full overflow-hidden md:col-span-1 aspect-video md:rounded-l-xl">
            <BannerImage banner={patch.banner} name={patch.name} />

            <EditBanner patch={patch} />
          </div>

          <div className="flex flex-col gap-4 p-6 md:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                {patch.name}
              </h1>
              <span
                className={
                  patch.contentLimit === 'sfw'
                    ? 'inline-flex items-center rounded-full bg-success-100 px-2.5 py-1 text-xs font-medium text-success-600'
                    : 'inline-flex items-center rounded-full bg-danger-100 px-2.5 py-1 text-xs font-medium text-danger-600'
                }
                title={GALGAME_AGE_LIMIT_DETAIL[patch.contentLimit]}
              >
                {GALGAME_AGE_LIMIT_MAP[patch.contentLimit]}
              </span>
            </div>

            <PatchRatingSummaryBadge patch={patch} />

            <div className="flex flex-wrap gap-2">
              <Tags patch={patch} />
            </div>

            <PatchHeaderActions patch={patch} />

            <div className="shrink-0 h-px bg-divider" />

            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <KunUser
                user={patch.user}
                userProps={{
                  name: `${patch.user.name} - ${formatTimeDifference(patch.created)}`,
                  avatarProps: {
                    showFallback: true,
                    name: patch.user.name.charAt(0).toUpperCase(),
                    src: patch.user.avatar,
                    size: 'sm',
                    className: 'border border-border/30'
                  }
                }}
              />
              <PatchStats patch={patch} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
