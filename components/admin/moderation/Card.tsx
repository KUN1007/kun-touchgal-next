'use client'

import {
  Avatar,
  Button,
  Card,
  CardBody,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@heroui/react'
import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { kunFetchPut } from '~/utils/kunFetch'
import { buildCommentLink } from '~/utils/patch/buildCommentLink'
import { KunTimeAgo } from '~/components/kun/TimeAgo'
import {
  MODERATION_CONTENT_TYPE_MAP,
  MODERATION_REJECT_CODE_MAP,
  MODERATION_TASK_STATUS_MAP
} from '~/constants/moderation'
import type { AdminModerationTask } from '~/types/api/admin'

const statusColorMap: Record<
  string,
  'warning' | 'success' | 'danger' | 'secondary' | 'default'
> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  manual: 'secondary',
  superseded: 'default'
}

// 与站内消息通知的深链格式一致 (createMentionMessage / rating like 等)
const contentLinkMap: Partial<
  Record<string, (uniqueId: string, contentId: number) => string>
> = {
  comment: (uniqueId, contentId) =>
    `/${uniqueId}?tab=comments&commentId=${contentId}`,
  rating: (uniqueId, contentId) =>
    `/${uniqueId}?tab=rating&ratingId=${contentId}`,
  resource: (uniqueId, contentId) =>
    `/${uniqueId}?tab=resources&resourceId=${contentId}`
}

interface Props {
  task: AdminModerationTask
  onRefresh: () => void
  onAddBlacklist: (pattern: string) => void
}

export const ModerationTaskCard = ({
  task,
  onRefresh,
  onAddBlacklist
}: Props) => {
  const [reviewing, setReviewing] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [pendingApprove, setPendingApprove] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()

  const openReviewModal = (approve: boolean) => {
    setPendingApprove(approve)
    onOpen()
  }

  const handleReview = async () => {
    setReviewing(true)
    try {
      const res = await kunFetchPut<KunResponse<{}>>(
        '/admin/moderation/review',
        {
          taskId: task.id,
          approve: pendingApprove
        }
      )
      if (typeof res === 'string') {
        toast.error(res)
        return
      }
      toast.success(pendingApprove ? '已改判为通过' : '已改判为拒绝')
      onClose()
      onRefresh()
    } finally {
      setReviewing(false)
    }
  }

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const res = await kunFetchPut<KunResponse<{}>>(
        '/admin/moderation/retry',
        { taskId: task.id }
      )
      if (typeof res === 'string') {
        toast.error(res)
        return
      }
      toast.success('已重新加入审核队列')
      onRefresh()
    } finally {
      setRetrying(false)
    }
  }

  const canReview = task.status === 'pending' || task.status === 'manual'
  // 仅审核失败转人工的任务可重试; verdict 非空为 AI 拿不准 (m=1) 转人工
  const canRetry = task.status === 'manual' && task.verdict == null

  const buildContentLink = contentLinkMap[task.contentType]
  const contentLink =
    buildContentLink && task.contentId !== null && task.patch
      ? // 评论深链与站内信同源 (资源评论指向资源详情页)
        task.contentType === 'comment'
        ? buildCommentLink(
            task.patch.uniqueId,
            task.contentId,
            task.commentResourceId ?? null
          )
        : buildContentLink(task.patch.uniqueId, task.contentId)
      : null

  return (
    <>
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip color="primary" variant="flat" size="sm">
              {MODERATION_CONTENT_TYPE_MAP[task.contentType] ??
                task.contentType}
            </Chip>
            <Chip
              color={statusColorMap[task.status] ?? 'default'}
              variant="flat"
              size="sm"
            >
              {MODERATION_TASK_STATUS_MAP[task.status] ?? task.status}
            </Chip>
            {task.dryRun && (
              <Chip color="secondary" variant="flat" size="sm">
                灰度
              </Chip>
            )}
            {task.rejectCode && (
              <Chip color="danger" variant="flat" size="sm">
                {MODERATION_REJECT_CODE_MAP[task.rejectCode] ?? task.rejectCode}
              </Chip>
            )}
            <span className="text-sm text-default-500">
              #{task.id} · <KunTimeAgo date={task.created} />
            </span>
            {contentLink && (
              <Button
                as={Link}
                href={contentLink}
                target="_blank"
                size="sm"
                color="primary"
                variant="flat"
                className="ml-auto"
                startContent={<ExternalLink className="size-4" />}
              >
                查看内容
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Avatar
              src={task.user.avatar}
              size="sm"
              showFallback
              name={task.user.name.charAt(0).toUpperCase()}
            />
            <span className="text-sm">{task.user.name}</span>
            {task.contentId && (
              <span className="text-sm text-default-500">
                内容 ID: {task.contentId}
              </span>
            )}
            {task.patch && (
              <span className="text-sm text-default-500">
                所属游戏:{' '}
                <Link
                  className="text-primary-500"
                  href={`/${task.patch.uniqueId}`}
                >
                  {task.patch.name}
                </Link>
              </span>
            )}
          </div>

          {task.contentType === 'avatar' &&
          (task.payload.archiveLink || task.payload.pendingLink) ? (
            // 优先用永久留档; 留档功能上线前的旧任务回退 pending 链接 (裁决后可能已失效)
            <img
              src={task.payload.archiveLink ?? task.payload.pendingLink}
              alt="送审头像"
              className="size-16 rounded-full object-cover"
            />
          ) : (
            <p className="whitespace-pre-wrap break-all rounded-lg bg-default-100 p-2 text-sm">
              {task.payload.text || '(无文本)'}
            </p>
          )}

          {task.rejectReason && (
            <p className="text-sm text-danger">原因: {task.rejectReason}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-default-600">
              {task.model ? `模型: ${task.model} · ` : ''}
              Token: {task.tokensIn} 入 / {task.tokensOut} 出
              {task.retry > 0 ? ` · 重试 ${task.retry} 次` : ''}
            </span>
            <div className="flex gap-2">
              {task.contentType !== 'avatar' && task.payload.text && (
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => onAddBlacklist(task.payload.text ?? '')}
                >
                  加入黑名单
                </Button>
              )}
              {canRetry && (
                <Button
                  size="sm"
                  color="warning"
                  variant="flat"
                  isLoading={retrying}
                  onPress={handleRetry}
                >
                  重试
                </Button>
              )}
              {canReview && (
                <>
                  <Button
                    size="sm"
                    color="success"
                    variant="flat"
                    onPress={() => openReviewModal(true)}
                  >
                    改判通过
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    onPress={() => openReviewModal(false)}
                  >
                    改判拒绝
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} placement="center">
        <ModalContent>
          <ModalHeader>
            {pendingApprove ? '改判为通过' : '改判为拒绝'}
          </ModalHeader>
          <ModalBody>
            确定要将任务 #{task.id} 改判为
            {pendingApprove ? '通过' : '拒绝'}吗? 改判会立即对用户内容生效
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              取消
            </Button>
            <Button
              color={pendingApprove ? 'success' : 'danger'}
              isLoading={reviewing}
              isDisabled={reviewing}
              onPress={handleReview}
            >
              {pendingApprove ? '确认改判通过' : '确认改判拒绝'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
