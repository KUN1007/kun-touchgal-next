'use client'

import { useState, useTransition } from 'react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@heroui/react'
import { Image } from '@heroui/image'
import { Trash2 } from 'lucide-react'
import Link from 'next/link'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { kunFetchPut } from '~/utils/kunFetch'
import toast from 'react-hot-toast'
import { cn } from '~/utils/cn'

interface Props {
  galgame: GalgameCard
  folderId: number
  pageUid: number
  currentUserUid: number
  onRemoveFavorite: (patchId: number) => void
}

export const UserGalgameCard = ({
  galgame,
  folderId,
  pageUid,
  currentUserUid,
  onRemoveFavorite
}: Props) => {
  const [isPending, startTransition] = useTransition()
  const [imageLoaded, setImageLoaded] = useState(false)

  const {
    isOpen: isOpenDelete,
    onOpen: onOpenDelete,
    onClose: onCloseDelete
  } = useDisclosure()
  const handleRemoveFavorite = () => {
    startTransition(async () => {
      const res = await kunFetchPut<KunResponse<{ added: boolean }>>(
        `/patch/favorite`,
        { patchId: galgame.id, folderId }
      )
      kunErrorHandler(res, () => {
        onCloseDelete()
        toast.success('取消收藏成功')
        onRemoveFavorite(galgame.id)
      })
    })
  }

  return (
    <Card className="relative w-full border border-default-100 dark:border-default-200">
      {pageUid === currentUserUid && (
        <Button
          isIconOnly
          size="sm"
          radius="full"
          color="danger"
          variant="solid"
          aria-label="从收藏夹移除"
          className="absolute right-1.5 top-1.5 z-20 opacity-70 hover:opacity-100"
          onPress={onOpenDelete}
          isDisabled={isPending}
          isLoading={isPending}
        >
          <Trash2 className="size-4" />
        </Button>
      )}

      <Link
        target="_blank"
        href={`/${galgame.uniqueId}`}
        prefetch={false}
        className="group block w-full outline-none"
      >
        <CardHeader className="p-0">
          <div className="relative w-full overflow-hidden rounded-t-lg opacity-90">
            <div
              className={cn(
                'absolute inset-0 animate-pulse bg-default-100',
                imageLoaded ? 'opacity-0' : 'opacity-90',
                'transition-opacity duration-300'
              )}
              style={{ aspectRatio: '16/9' }}
            />
            <Image
              alt={galgame.name}
              className={cn(
                'size-full object-cover transition-all duration-300',
                imageLoaded ? 'scale-100 opacity-90' : 'scale-105 opacity-0'
              )}
              radius="none"
              removeWrapper={true}
              src={
                galgame.banner
                  ? galgame.banner.replace(/\.avif$/, '-mini.avif')
                  : '/touchgal.avif'
              }
              style={{ aspectRatio: '16/9' }}
              onLoad={() => setImageLoaded(true)}
            />
          </div>
        </CardHeader>

        <CardBody className="gap-3">
          <span className="font-semibold transition-colors text-small sm:text-base line-clamp-2 group-hover:text-primary-500 group-focus-visible:text-primary-500">
            {galgame.name}
          </span>
        </CardBody>
      </Link>

      <Modal isOpen={isOpenDelete} onClose={onCloseDelete} placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">移除游戏</ModalHeader>
          <ModalBody>您确定要从收藏夹移除这个游戏吗</ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCloseDelete}>
              取消
            </Button>
            <Button
              color="danger"
              onPress={handleRemoveFavorite}
              disabled={isPending}
              isLoading={isPending}
            >
              移除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  )
}
