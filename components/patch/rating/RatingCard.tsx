'use client'

import { useState } from 'react'
import { Card, CardBody } from '@heroui/card'
import { Alert, Button, Chip, Tooltip } from '@heroui/react'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@heroui/modal'
import { Pencil, Star, Trash2 } from 'lucide-react'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import { formatTimeDifference } from '~/utils/time'
import { RatingLikeButton } from './RatingLike'
import { useUserStore } from '~/store/userStore'
import toast from 'react-hot-toast'
import { kunFetchDelete } from '~/utils/kunFetch'
import { RatingModal } from './RatingModal'
import {
  KUN_GALGAME_RATING_RECOMMEND_MAP,
  KUN_GALGAME_RATING_PLAY_STATUS_MAP,
  KUN_GALGAME_RATING_SPOILER_MAP
} from '~/constants/galgame'
import type { KunPatchRating } from '~/types/api/galgame'

interface Props {
  rating: KunPatchRating
  patchId: number
  onRatingUpdated: (rating: KunPatchRating) => void
  onDeleted: (ratingId: number) => void
}

export const RatingCard = ({
  rating,
  patchId,
  onRatingUpdated,
  onDeleted
}: Props) => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { user } = useUserStore((state) => state)
  const [isShowSpoiler, setIsShowSpoiler] = useState(false)

  const canEdit = user.uid === rating.user.id || user.role >= 3

  const {
    isOpen: isOpenDelete,
    onOpen: onOpenDelete,
    onClose: onCloseDelete
  } = useDisclosure()
  const [deleting, setDeleting] = useState(false)
  const handleDeleteRating = async () => {
    if (!canEdit) {
      toast.error('您没有权限删除该评价')
      return
    }

    setDeleting(true)
    await kunFetchDelete<KunResponse<{}>>('/patch/rating', {
      ratingId: rating.id
    })
    setDeleting(false)

    onDeleted(rating.id)
    onCloseDelete()
    toast.success('Galgame 评价删除成功')
  }

  return (
    <Card>
      <CardBody>
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <KunUser
              user={rating.user}
              userProps={{
                name: rating.user.name,
                description: `发布于 ${formatTimeDifference(rating.created)}`,
                avatarProps: {
                  src: rating.user.avatar
                }
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Chip color="primary" variant="flat">
                {KUN_GALGAME_RATING_RECOMMEND_MAP[rating.recommend]}
              </Chip>
              <Chip color="secondary" variant="flat">
                {KUN_GALGAME_RATING_PLAY_STATUS_MAP[rating.playStatus]}
              </Chip>
            </div>

            <span className="text-warning flex items-center gap-1 text-3xl font-bold">
              <Star fill="#F5A524" class-name="text-2xl" />
              {rating.overall}
            </span>
          </div>

          {rating.spoilerLevel !== 'none' && (
            <div className="flex items-center justify-center w-full">
              <Alert
                color="warning"
                description="点击显示以显示这条含有剧透的评价"
                endContent={
                  <Button
                    onPress={() => setIsShowSpoiler(!isShowSpoiler)}
                    color="warning"
                    variant="flat"
                  >
                    显示
                  </Button>
                }
                title={KUN_GALGAME_RATING_SPOILER_MAP[rating.spoilerLevel]}
                variant="faded"
              />
            </div>
          )}

          {rating.shortSummary && isShowSpoiler && (
            <p className="text-default-700 whitespace-pre-wrap">
              {rating.shortSummary}
            </p>
          )}

          <div className="flex gap-2 mt-3">
            <RatingLikeButton rating={rating} />

            <div className="flex gap-2">
              {canEdit && (
                <>
                  <Tooltip content="编辑">
                    <Button
                      variant="bordered"
                      isIconOnly
                      size="sm"
                      onPress={onOpen}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="删除">
                    <Button
                      variant="bordered"
                      isIconOnly
                      size="sm"
                      onPress={onOpenDelete}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
        </div>
      </CardBody>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        isDismissable={false}
        isKeyboardDismissDisabled={true}
      >
        <RatingModal
          isOpen={isOpen}
          onClose={onClose}
          patchId={patchId}
          onSuccess={onRatingUpdated}
          initial={rating}
        />
      </Modal>

      <Modal isOpen={isOpenDelete} onClose={onCloseDelete} placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            删除资源链接
          </ModalHeader>
          <ModalBody>
            <p>
              您确定要删除这条资源链接吗,
              这将会导致您发布资源链接获得的萌萌点被扣除, 该操作不可撤销
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCloseDelete}>
              取消
            </Button>
            <Button
              color="danger"
              onPress={handleDeleteRating}
              disabled={deleting}
              isLoading={deleting}
            >
              删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  )
}
