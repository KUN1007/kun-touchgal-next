'use client'

import dynamic from 'next/dynamic'
import { Button } from '@heroui/button'
import { Modal, ModalContent, ModalHeader, useDisclosure } from '@heroui/modal'
import { useUserStore } from '~/store/userStore'
import type { Patch } from '~/types/api/patch'
import { KunLoading } from '~/components/kun/Loading'

const RewritePatchBanner = dynamic(
  () =>
    import('~/components/edit/rewrite/RewritePatchBanner').then(
      (mod) => mod.RewritePatchBanner
    ),
  {
    ssr: false,
    loading: () => (
      <KunLoading className="min-h-48" hint="正在加载图片编辑器..." />
    )
  }
)

interface PatchHeaderBannerProps {
  patch: Patch
}

export const EditBanner = ({ patch }: PatchHeaderBannerProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const user = useUserStore((state) => state.user)

  return (
    <>
      {(user.uid === patch.user.id || user.role > 2) && (
        <Button
          color="default"
          variant="shadow"
          size="sm"
          className="absolute z-10 bottom-3 left-3 backdrop-blur-sm bg-background/40"
          onPress={onOpen}
        >
          更改图片
        </Button>
      )}

      <Modal isOpen={isOpen} onClose={onClose} placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            更改预览图片
          </ModalHeader>
          {isOpen && (
            <RewritePatchBanner patchId={patch.id} onClose={onClose} />
          )}
        </ModalContent>
      </Modal>
    </>
  )
}
