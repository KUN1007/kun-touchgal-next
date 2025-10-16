'use client'

import { useState } from 'react'
import { kunFetchPut } from '~/utils/kunFetch'
import { Button } from '@heroui/button'
import { Tooltip } from '@heroui/tooltip'
import { ThumbsUp } from 'lucide-react'
import { useUserStore } from '~/store/userStore'
import toast from 'react-hot-toast'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { cn } from '~/utils/cn'
import type { KunPatchRating } from '~/types/api/galgame'

interface Props {
  rating: KunPatchRating
}

export const RatingLikeButton = ({ rating }: Props) => {
  const { user } = useUserStore((state) => state)
  const [liked, setLiked] = useState(rating.isLike)
  const [likeCount, setLikeCount] = useState(rating.likeCount)
  const [loading, setLoading] = useState(false)

  const toggleLike = async () => {
    if (!user.uid) {
      toast.error('请先登录')
      return
    }
    if (rating.user.id === user.uid) {
      toast.error('您不能给自己点赞')
      return
    }

    setLoading(true)
    const res = await kunFetchPut<KunResponse<boolean>>('/patch/rating/like', {
      ratingId: rating.id
    })
    setLoading(false)

    kunErrorHandler(res, (value) => {
      setLiked(value)
      setLikeCount((prev) => (value ? prev + 1 : prev - 1))
    })
  }

  return (
    <Tooltip key="like" color="default" content="点赞" placement="bottom">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        disabled={loading}
        isLoading={loading}
        onPress={toggleLike}
      >
        <ThumbsUp className={cn('w-4 h-4', liked ? 'text-danger-500' : '')} />
        {likeCount}
      </Button>
    </Tooltip>
  )
}
