'use client'

import { useState } from 'react'
import { Card, CardBody } from '@heroui/card'
import { Chip } from '@heroui/chip'
import { Link } from '@heroui/link'
import { Tooltip } from '@heroui/tooltip'
import { Eye, EyeOff, Star, ThumbsUp } from 'lucide-react'
import {
  KUN_GALGAME_RATING_PLAY_STATUS_MAP,
  KUN_GALGAME_RATING_RECOMMEND_MAP,
  KUN_GALGAME_RATING_SPOILER_MAP
} from '~/constants/galgame'
import { KunTimeAgo } from '~/components/kun/TimeAgo'
import type { UserRating } from '~/types/api/user'

interface Props {
  rating: UserRating
}

const getRecommendColor = (
  recommend: string
): 'success' | 'primary' | 'default' | 'warning' | 'danger' => {
  switch (recommend) {
    case 'strong_yes':
      return 'success'
    case 'yes':
      return 'primary'
    case 'neutral':
      return 'default'
    case 'no':
      return 'warning'
    case 'strong_no':
      return 'danger'
    default:
      return 'default'
  }
}

const getScoreColor = (
  score: number
): 'success' | 'primary' | 'warning' | 'danger' => {
  if (score >= 8) {
    return 'success'
  }
  if (score >= 6) {
    return 'primary'
  }
  if (score >= 4) {
    return 'warning'
  }
  return 'danger'
}

export const UserRatingCard = ({ rating }: Props) => {
  const [isShowSummary, setIsShowSummary] = useState(
    rating.spoilerLevel === 'none'
  )

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            color={getScoreColor(rating.overall)}
            variant="flat"
            startContent={<Star className="size-4" fill="currentColor" />}
            className="gap-1"
          >
            {rating.overall}/10
          </Chip>

          <Chip
            color={getRecommendColor(rating.recommend)}
            variant="flat"
            size="sm"
          >
            {KUN_GALGAME_RATING_RECOMMEND_MAP[rating.recommend] ??
              rating.recommend}
          </Chip>

          <Chip variant="flat" size="sm">
            {KUN_GALGAME_RATING_PLAY_STATUS_MAP[rating.playStatus] ??
              rating.playStatus}
          </Chip>
        </div>

        {rating.shortSummary ? (
          <>
            {rating.spoilerLevel !== 'none' && !isShowSummary ? (
              <button
                type="button"
                onClick={() => setIsShowSummary(true)}
                className="flex w-full flex-col items-start rounded-lg border border-warning-200 bg-warning-50 p-3 text-left transition-colors hover:bg-warning-100 dark:border-warning-500/20 dark:bg-warning-100/10 dark:hover:bg-warning-100/20"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-warning-600 dark:text-warning-500">
                  <EyeOff className="size-4" />
                  {KUN_GALGAME_RATING_SPOILER_MAP[rating.spoilerLevel] ??
                    '本评价包含剧透'}
                </span>
                <span className="mt-1 text-xs text-warning-500 dark:text-warning-400">
                  点击显示评价内容
                </span>
              </button>
            ) : (
              <div className="space-y-2">
                {rating.spoilerLevel !== 'none' && (
                  <button
                    type="button"
                    onClick={() => setIsShowSummary(false)}
                    className="flex items-center gap-1 text-xs text-warning-600 transition-colors hover:text-warning-500 dark:text-warning-500 dark:hover:text-warning-400"
                  >
                    <Eye className="size-3.5" />
                    隐藏剧透内容
                  </button>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">
                  {rating.shortSummary}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-default-500">这条评价没有填写短评内容</p>
        )}

        <div className="flex items-center justify-between text-default-500">
          <span className="text-sm text-muted-foreground">
            发布于 <KunTimeAgo date={rating.created} />
          </span>

          <Tooltip content="点赞数">
            <Chip
              startContent={<ThumbsUp className="size-4" />}
              variant="light"
              size="sm"
              className="gap-2 text-default-500"
            >
              {rating.like}
            </Chip>
          </Tooltip>
        </div>

        <div className="text-sm text-default-500">
          位置{' '}
          <Link
            size="sm"
            underline="always"
            href={`/${rating.patchUniqueId}?tab=rating&ratingId=${rating.id}`}
          >
            {rating.patchName}
          </Link>
        </div>
      </CardBody>
    </Card>
  )
}
