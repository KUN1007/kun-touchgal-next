'use client'

import { useState } from 'react'
import { Button, Tooltip } from '@heroui/react'
import { Download, Pencil, Share2, Trash2 } from 'lucide-react'
import { useRouter } from '@bprogress/next'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@heroui/modal'
import { useUserStore } from '~/store/userStore'
import { kunFetchDelete } from '~/utils/kunFetch'
import { kunCopy } from '~/utils/kunCopy'
import { kunMoyuMoe } from '~/config/moyu-moe'
import toast from 'react-hot-toast'
import { FavoriteButton } from './button/favorite/FavoriteButton'
import { RatingButton } from './button/rating/RatingButton'
import { FeedbackButton } from './button/FeedbackButton'
import type { Patch } from '~/types/api/patch'

interface PatchHeaderActionsProps {
  patch: Patch
  handleClickDownloadNav: () => void
}

export const PatchHeaderActions = ({
  patch,
  handleClickDownloadNav
}: PatchHeaderActionsProps) => {
  const router = useRouter()
  const { user } = useUserStore((state) => state)

  const { isOpen, onOpen, onClose } = useDisclosure()
  const [deleting, setDeleting] = useState(false)

  const handleShareLink = () => {
    const text = `${patch.name} - ${kunMoyuMoe.domain.main}/patch/${patch.id}/introduction`
    kunCopy(text)
  }

  const handleDelete = async () => {
    setDeleting(true)
    const res = await kunFetchDelete<KunResponse<{}>>('/patch', {
      patchId: patch.id
    })

    if (typeof res === 'string') {
      toast.error(res)
    } else {
      toast.success('删除 Galgame 成功')
      router.push('/')
    }

    onClose()
    setDeleting(false)
  }

  const handlePressDeleteButton = () => {
    if (user.uid !== patch.user.id && user.role < 4) {
      toast.error('仅游戏发布者或超级管理员可删除该游戏')
      return
    }
    onOpen()
  }

  return (
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex flex-wrap gap-2">
        <Tooltip content="下载游戏">
          <Button
            color="primary"
            variant="shadow"
            startContent={<Download className="size-4" />}
            onPress={handleClickDownloadNav}
            size="sm"
          >
            下载
          </Button>
        </Tooltip>

        <RatingButton patchId={patch.id} />

        <FavoriteButton patchId={patch.id} isFavorite={patch.isFavorite} />

        <Tooltip content="复制分享链接">
          <Button
            variant="bordered"
            isIconOnly
            size="sm"
            onPress={handleShareLink}
            aria-label="复制分享链接"
          >
            <Share2 className="size-4" />
          </Button>
        </Tooltip>

        {user.role > 2 ? (
          <>
            <Tooltip content="编辑游戏信息">
              <Button
                variant="bordered"
                isIconOnly
                size="sm"
                onPress={() => router.push('/edit/rewrite')}
                aria-label="编辑游戏信息"
              >
                <Pencil className="size-4" />
              </Button>
            </Tooltip>

            <Tooltip content="删除游戏">
              <Button
                variant="bordered"
                isIconOnly
                size="sm"
                onPress={handlePressDeleteButton}
                aria-label="删除游戏"
              >
                <Trash2 className="size-4" />
              </Button>
            </Tooltip>

            <FeedbackButton patch={patch} />
          </>
        ) : (
          <FeedbackButton patch={patch} />
        )}
      </div>

      <p className="text-xs text-default-500">
        收藏后, 有新补丁资源发布时, 您将收到通知
      </p>

      <Modal isOpen={isOpen} onClose={onClose} placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            永久删除 Galgame
          </ModalHeader>
          <ModalBody>
            严重警告, 删除 Galgame 将会删除这个 Galgame 下面所有的评论,
            所有的资源链接, 所有的贡献历史记录, 您确定要删除吗
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              取消
            </Button>
            <Button
              color="danger"
              onPress={handleDelete}
              isDisabled={deleting}
              isLoading={deleting}
            >
              删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
