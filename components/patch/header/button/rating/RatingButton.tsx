'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@heroui/button'
import { Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { useUserStore } from '~/store/userStore'
import { LazyDialogFallback } from '../../LazyDialogFallback'

const RatingButtonDialog = dynamic(() => import('./RatingButtonDialog'), {
  ssr: false,
  loading: () => <LazyDialogFallback hint="正在加载评分弹窗..." />
})

const preloadRatingButtonDialog = () => {
  void import('./RatingButtonDialog')
}

interface Props {
  patchId: number
}

export const RatingButton = ({ patchId }: Props) => {
  const user = useUserStore((state) => state.user)
  const [isOpen, setIsOpen] = useState(false)

  const onPress = () => {
    if (!user.uid) {
      toast.error('请登录后再评分')
      return
    }
    setIsOpen(true)
  }

  return (
    <>
      <Button
        variant="flat"
        color="primary"
        startContent={<Star className="size-4" />}
        size="sm"
        onPress={onPress}
        onMouseEnter={preloadRatingButtonDialog}
        onFocus={preloadRatingButtonDialog}
        title="提交评分"
      >
        评分
      </Button>

      {isOpen && (
        <RatingButtonDialog
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          patchId={patchId}
        />
      )}
    </>
  )
}
