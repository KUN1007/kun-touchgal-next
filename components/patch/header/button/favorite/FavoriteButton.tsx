'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@heroui/button'
import { Heart } from 'lucide-react'
import { useUserStore } from '~/store/userStore'
import toast from 'react-hot-toast'
import { LazyDialogFallback } from '../../LazyDialogFallback'
import { cn } from '~/utils/cn'

const FavoriteModal = dynamic(() => import('./FavoriteModal'), {
  ssr: false,
  loading: () => <LazyDialogFallback hint="正在加载收藏夹..." />
})

const preloadFavoriteModal = () => {
  void import('./FavoriteModal')
}

interface Props {
  patchId: number
  isFavorite: boolean
}

export const FavoriteButton = ({ patchId, isFavorite }: Props) => {
  const user = useUserStore((state) => state.user)
  const [isOpen, setIsOpen] = useState(false)

  const toggleLike = async () => {
    if (!user.uid) {
      toast.error('请登录以收藏')
      return
    }

    setIsOpen(true)
  }

  return (
    <>
      <Button
        isIconOnly
        size="sm"
        color={isFavorite ? 'danger' : 'default'}
        variant={isFavorite ? 'flat' : 'bordered'}
        onPress={toggleLike}
        onPointerEnter={preloadFavoriteModal}
        onFocus={preloadFavoriteModal}
        aria-label={isFavorite ? '取消收藏' : '收藏'}
        title={isFavorite ? '取消收藏' : '收藏'}
        className="min-w-0 px-2"
      >
        <Heart
          fill={isFavorite ? '#f31260' : 'none'}
          className={cn('size-4', isFavorite ? 'text-danger-500' : '')}
        />
      </Button>

      {isOpen && (
        <FavoriteModal
          patchId={patchId}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
