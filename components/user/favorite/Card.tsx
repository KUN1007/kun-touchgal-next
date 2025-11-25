'use client'

import { useTransition } from 'react'
import {
  Button,
  Card,
  CardBody,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@heroui/react'
import { Image } from '@heroui/image'
import Link from 'next/link'
import { KunCardStats } from '~/components/kun/CardStats'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { kunFetchPut } from '~/utils/kunFetch'
import toast from 'react-hot-toast'

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
    <Card className="w-full">
      <CardBody className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative w-full sm:h-auto sm:w-40">
            <Image
              src={galgame.banner.replace(/\.avif$/, '-mini.avif')}
              alt={galgame.name}
              className="object-cover rounded-lg size-full max-h-52"
              radius="lg"
            />
          </div>
          <div className="flex-1 space-y-3">
            <Link
              target="_blank"
              href={`/${galgame.uniqueId}`}
              className="text-lg font-semibold transition-colors line-clamp-2 hover:text-primary-500"
            >
              {galgame.name}
            </Link>

            <KunCardStats patch={galgame} isMobile={true} />

            {pageUid === currentUserUid && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
                  onPress={onOpenDelete}
                  isDisabled={isPending}
                  isLoading={isPending}
                >
                  从收藏夹移除
                </Button>
              </div>
            )}

            <Modal
              isOpen={isOpenDelete}
              onClose={onCloseDelete}
              placement="center"
            >
              <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                  移除游戏
                </ModalHeader>
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
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
