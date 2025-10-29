import { Tooltip } from '@heroui/tooltip'
import { Download, Eye, Heart, MessageSquare, Puzzle } from 'lucide-react'
import { cn } from '~/utils/cn'
import { formatNumber } from '~/utils/formatNumber'

interface Props {
  patch: GalgameCard
  disableTooltip?: boolean
  className?: string
  isMobile?: boolean
}

export const KunCardStats = ({
  patch,
  disableTooltip = true,
  isMobile = false
}: Props) => {
  return (
    <div
      className={cn(
        'flex space-x-2 justify-between text-sm sm:space-x-4 text-default-500',
        isMobile ? 'sm:justify-start' : ''
      )}
    >
      <Tooltip isDisabled={disableTooltip} content="浏览数" placement="bottom">
        <div className="flex items-center gap-1">
          <Eye className="size-4" />
          <span>{formatNumber(patch.view)}</span>
        </div>
      </Tooltip>

      <Tooltip isDisabled={disableTooltip} content="下载数" placement="bottom">
        <div className="flex items-center gap-1">
          <Download className="size-4" />
          <span>{formatNumber(patch.download)}</span>
        </div>
      </Tooltip>

      <Tooltip isDisabled={disableTooltip} content="收藏数" placement="bottom">
        <div className="flex items-center gap-1">
          <Heart className="size-4" />
          <span>{formatNumber(patch._count.favorite_folder || 0)}</span>
        </div>
      </Tooltip>

      {!isMobile && (
        <Tooltip
          isDisabled={disableTooltip}
          content="下载资源数"
          placement="bottom"
        >
          <div className="flex items-center gap-1">
            <Puzzle className="size-4" />
            <span>{formatNumber(patch._count.resource || 0)}</span>
          </div>
        </Tooltip>
      )}

      <Tooltip isDisabled={disableTooltip} content="评论数" placement="bottom">
        <div
          className={cn(
            'flex items-center gap-1',
            isMobile && 'sm:flex hidden'
          )}
        >
          <MessageSquare className="size-4" />
          <span>{formatNumber(patch._count.comment || 0)}</span>
        </div>
      </Tooltip>
    </div>
  )
}
