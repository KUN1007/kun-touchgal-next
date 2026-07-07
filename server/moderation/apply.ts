import { prisma } from '~/prisma/index'
import type { Prisma } from '~/prisma/generated/prisma/client'
import type { moderation_taskModel } from '~/prisma/generated/prisma/models'
import { createDedupMessage, createMessage } from '~/app/api/utils/message'
import { createMentionMessage } from '~/app/api/utils/createMentionMessage'
import { recomputePatchRatingStat } from '~/app/api/patch/rating/stat'
import { recalcPatchType } from '~/app/api/patch/resource/_helper'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import { invalidateUserSession } from '~/app/api/user/session/cache'
import { queueSearchSync } from '~/server/search/sync'
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
  let avatarCleared = false

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
        // approve 只放行仍屏蔽(1); reject 需隐藏仍屏蔽(1)或已被 m=1 放行(0)的评论,
        // 否则超管对 m=1 任务的拒绝会静默空操作 —— 违规评论仍公开可见
        const updated = await tx.patch_comment.updateMany({
          where: {
            id: task.content_id ?? 0,
            status: approved ? 1 : { in: [0, 1] }
          },
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
        // approve 只放行仍屏蔽(1); reject 对仍屏蔽(1)或已被 m=1 放行(0)的评分都要隐藏
        if (
          rating &&
          (approved
            ? rating.status === 1
            : rating.status === 0 || rating.status === 1)
        ) {
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
        // approve 只放行仍屏蔽(1); reject 对仍屏蔽(1)或已被 m=1 放行(0)的资源都要隐藏
        if (
          resource &&
          (approved
            ? resource.status === 1
            : resource.status === 0 || resource.status === 1)
        ) {
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
        const payload = task.payload as unknown as ModerationAvatarPayload
        if (approved) {
          await tx.user.update({
            where: { id: task.user_id },
            data: { avatar: payload.avatarLink }
          })
        } else {
          // 仅清除已被 m=1 放行落地的违规头像 (user.avatar 仍是本任务写入的带版本值);
          // pending / 转人工失败的头像从未应用, 条件不匹配则不动用户现有头像.
          // 单条原子 updateMany, 避免读-改之间的竞态窗口
          const cleared = await tx.user.updateMany({
            where: { id: task.user_id, avatar: payload.avatarLink },
            data: { avatar: '' }
          })
          // 记录是否真的清了正式头像, 供 commit 后删除正式 S3 对象 + purge CDN
          avatarCleared = cleared.count > 0
        }
        break
      }
      case 'bio': {
        const payload = task.payload as unknown as ModerationTextPayload
        if (approved) {
          await tx.user.update({
            where: { id: task.user_id },
            data: { bio: payload.bio ?? '' }
          })
        } else {
          // 清除仍公开展示的违规签名: 仅当 user.bio 当前正是本任务送审文本时才清
          // (等值即"违规文本此刻可见"); 新签名未落地时 user.bio 仍是旧值, 不匹配则不动
          await tx.user.updateMany({
            where: { id: task.user_id, bio: payload.bio ?? '' },
            data: { bio: '' }
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
    queueSearchSync(resourcePatchId)
    await invalidateResourceListCache()
  }
  if (task.content_type === 'avatar') {
    const payload = task.payload as unknown as ModerationAvatarPayload
    const imageBedUrl = process.env.KUN_VISUAL_NOVEL_IMAGE_BED_URL
    await invalidateUserSession(task.user_id)
    // approve: 新头像已复制到正式 key, 刷新 CDN; cleared-reject: 违规头像正被删除,
    // 同样需失效其 CDN 缓存, 否则删了源对象仍可从边缘取到旧图
    if (approved || avatarCleared) {
      await purgeCloudflareCache([
        `${imageBedUrl}/${payload.avatarKey}`,
        `${imageBedUrl}/${payload.avatarMiniKey}`
      ])
    }
    // 违规头像在 m=1 放行时已复制到正式 key; 拒绝并清空 user.avatar 后删除正式对象,
    // 否则仍可经稳定 URL 直取. 仅在确实清空时删, 避免误删 pending 拒绝下用户仍在用的头像
    if (!approved && avatarCleared) {
      await deleteFileFromS3(payload.avatarKey).catch((error) =>
        console.error('Failed to delete rejected avatar:', error)
      )
      await deleteFileFromS3(payload.avatarMiniKey).catch((error) =>
        console.error('Failed to delete rejected mini avatar:', error)
      )
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
