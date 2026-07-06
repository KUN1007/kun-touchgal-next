import { prisma } from '~/prisma/index'
import type { Prisma } from '~/prisma/generated/prisma/client'
import type { moderation_taskModel } from '~/prisma/generated/prisma/models'
import { createDedupMessage, createMessage } from '~/app/api/utils/message'
import { createMentionMessage } from '~/app/api/utils/createMentionMessage'
import { recomputePatchRatingStat } from '~/app/api/patch/rating/stat'
import { recalcPatchType } from '~/app/api/patch/resource/_helper'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import { invalidateUserSession } from '~/app/api/user/session/cache'
import { purgeCloudflareCache } from '~/app/api/utils/purgeCloudflareCache'
import { copyObject, deleteFileFromS3 } from '~/lib/s3'
import {
  MODERATION_REJECT_CODE_MAP,
  MODERATION_REJECT_NOTICE
} from '~/constants/moderation'
import { APPEAL_CONTENT_TYPE, APPEAL_SETTINGS_LINK } from '~/constants/appeal'
import type { ModerationAvatarPayload, ModerationTextPayload } from './submit'

export interface ApplyVerdictOptions {
  task: moderation_taskModel
  approved: boolean
  // verdict m=1: content is approved but the task goes to manual review
  manual?: boolean
  rejectCode?: string
  rejectReason?: string
  verdict?: Prisma.InputJsonValue
  model?: string
  tokensIn?: number
  tokensOut?: number
  // 'pending' for the worker; 'manual' when an admin re-judges
  fromStatus?: 'pending' | 'manual'
}

// AI failed permanently or is misconfigured: task goes to manual review,
// content stays shadow banned - never auto-reject on provider failure
export const markTaskManual = async (taskId: number, reason: string) =>
  prisma.moderation_task.updateMany({
    where: { id: taskId, status: 'pending' },
    data: { status: 'manual', reject_reason: reason.slice(0, 500) }
  })

// 创建时被拦截而未发送的回复与提及通知, 在评论对他人可见后补发
export const sendDeferredCommentNotifications = async (commentId: number) => {
  const comment = await prisma.patch_comment.findUnique({
    where: { id: commentId },
    include: {
      patch: { select: { name: true, unique_id: true } },
      user: { select: { name: true } },
      parent: { select: { user_id: true, content: true } }
    }
  })
  if (!comment) {
    return
  }
  if (comment.parent && comment.parent.user_id !== comment.user_id) {
    await createDedupMessage({
      type: 'comment',
      content: `回复了您的评论：${comment.parent.content.slice(0, 107)}`,
      sender_id: comment.user_id,
      recipient_id: comment.parent.user_id,
      link: `/${comment.patch.unique_id}?tab=comments&commentId=${comment.id}`
    })
  }
  await createMentionMessage(
    comment.patch.unique_id,
    comment.patch.name,
    comment.id,
    comment.user_id,
    comment.user.name,
    comment.content
  )
}

const resolveRejectReason = (rejectCode?: string, rejectReason?: string) =>
  rejectReason ||
  (rejectCode ? MODERATION_REJECT_CODE_MAP[rejectCode] : '') ||
  '包含违规内容'

// Applies a moderation verdict idempotently: the task row transition is the
// gate - if the task already left `fromStatus`, nothing happens.
// Returns false when the claim failed.
export const applyModerationVerdict = async (
  options: ApplyVerdictOptions
): Promise<boolean> => {
  const {
    task,
    approved,
    manual = false,
    rejectCode,
    rejectReason,
    verdict,
    model,
    tokensIn,
    tokensOut,
    fromStatus = 'pending'
  } = options

  const taskStatus = approved ? (manual ? 'manual' : 'approved') : 'rejected'
  const reason = resolveRejectReason(rejectCode, rejectReason)

  // S3 copy is idempotent, do it before claiming so that a copy failure
  // leaves the task pending and retryable
  if (!task.dry_run && task.content_type === 'avatar' && approved) {
    const payload = task.payload as unknown as ModerationAvatarPayload
    await copyObject(payload.pendingKey, payload.avatarKey)
    await copyObject(payload.pendingMiniKey, payload.avatarMiniKey)
  }

  let claimed = false
  let ratingPatchId: number | null = null
  let resourcePatchId: number | null = null
  let commentApproved = false

  await prisma.$transaction(async (tx) => {
    const claim = await tx.moderation_task.updateMany({
      where: { id: task.id, status: fromStatus },
      data: {
        status: taskStatus,
        reject_code: approved ? '' : (rejectCode ?? ''),
        reject_reason: approved ? '' : reason,
        ...(verdict !== undefined ? { verdict } : {}),
        model: model ?? '',
        tokens_in: tokensIn ?? 0,
        tokens_out: tokensOut ?? 0,
        reviewed: taskStatus === 'manual' ? null : new Date()
      }
    })
    if (claim.count === 0) {
      return
    }
    claimed = true

    if (task.dry_run) {
      return
    }

    switch (task.content_type) {
      case 'comment': {
        // guard on status=1 so an admin's manual decision is never overwritten
        const updated = await tx.patch_comment.updateMany({
          where: { id: task.content_id ?? 0, status: 1 },
          data: { status: approved ? 0 : 2 }
        })
        commentApproved = approved && updated.count > 0
        break
      }
      case 'rating': {
        const rating = await tx.patch_rating.findUnique({
          where: { id: task.content_id ?? 0 },
          select: { patch_id: true, status: true }
        })
        if (rating?.status === 1) {
          await tx.patch_rating.update({
            where: { id: task.content_id ?? 0 },
            data: { status: approved ? 0 : 2 }
          })
          ratingPatchId = rating.patch_id
        }
        break
      }
      case 'resource': {
        const resource = await tx.patch_resource.findUnique({
          where: { id: task.content_id ?? 0 },
          select: { patch_id: true, status: true }
        })
        if (resource?.status === 1) {
          await tx.patch_resource.update({
            where: { id: task.content_id ?? 0 },
            data: { status: approved ? 0 : 3 }
          })
          // visible resource set changed, keep aggregates consistent with
          // the admin hidden flow
          await recalcPatchType(resource.patch_id, tx)
          resourcePatchId = resource.patch_id
        }
        break
      }
      case 'avatar': {
        if (approved) {
          const payload = task.payload as unknown as ModerationAvatarPayload
          await tx.user.update({
            where: { id: task.user_id },
            data: { avatar: payload.avatarLink }
          })
        }
        break
      }
      case 'bio': {
        if (approved) {
          const payload = task.payload as unknown as ModerationTextPayload
          await tx.user.update({
            where: { id: task.user_id },
            data: { bio: payload.bio ?? '' }
          })
        }
        break
      }
    }

    if (!approved) {
      const payload = task.payload as unknown as ModerationTextPayload
      const notice =
        task.content_type === 'resource'
          ? MODERATION_REJECT_NOTICE.resource(payload.name ?? '', reason)
          : MODERATION_REJECT_NOTICE[
              task.content_type as 'comment' | 'rating' | 'avatar' | 'bio'
            ](reason)
      await createMessage(
        {
          type: 'system',
          content: notice,
          // 可申诉类型 (被隐藏的内容) 引导用户到申诉页; avatar/bio 未被应用, 无申诉入口
          link: (APPEAL_CONTENT_TYPE as readonly string[]).includes(
            task.content_type
          )
            ? APPEAL_SETTINGS_LINK
            : '',
          recipient_id: task.user_id
        },
        tx
      )
    }
  })

  if (!claimed) {
    return false
  }
  if (task.dry_run) {
    return true
  }

  // post-commit side effects
  if (commentApproved) {
    await sendDeferredCommentNotifications(task.content_id ?? 0)
  }
  if (ratingPatchId !== null) {
    await recomputePatchRatingStat(ratingPatchId)
  }
  if (resourcePatchId !== null) {
    await invalidateResourceListCache()
  }
  if (task.content_type === 'avatar') {
    const payload = task.payload as unknown as ModerationAvatarPayload
    await invalidateUserSession(task.user_id)
    if (approved) {
      const imageBedUrl = process.env.KUN_VISUAL_NOVEL_IMAGE_BED_URL
      await purgeCloudflareCache([
        `${imageBedUrl}/${payload.avatarKey}`,
        `${imageBedUrl}/${payload.avatarMiniKey}`
      ])
    }
    await deleteFileFromS3(payload.pendingKey).catch((error) =>
      console.error('Failed to delete pending avatar:', error)
    )
    await deleteFileFromS3(payload.pendingMiniKey).catch((error) =>
      console.error('Failed to delete pending mini avatar:', error)
    )
  }
  if (task.content_type === 'bio') {
    await invalidateUserSession(task.user_id)
  }

  return true
}
