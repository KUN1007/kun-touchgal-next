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
  MODERATION_REJECT_NOTICE,
  MODERATION_S3_TIMEOUT_MS
} from '~/constants/moderation'
import { APPEAL_CONTENT_TYPE, APPEAL_SETTINGS_LINK } from '~/constants/appeal'
import type { ModerationAvatarPayload, ModerationTextPayload } from './submit'

export interface ApplyVerdictOptions {
  task: moderation_taskModel
  approved: boolean
  // verdict m=1: 内容保持待审核, task 转人工复审, 等人工最终裁决
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
// content stays pending - never auto-reject on provider failure
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

  const taskStatus = manual ? 'manual' : approved ? 'approved' : 'rejected'
  const reason = resolveRejectReason(rejectCode, rejectReason)

  // S3 copy is idempotent, do it before claiming so that a copy failure
  // leaves the task pending and retryable; m=1 转人工时不落地, 等人工最终裁决
  if (!task.dry_run && task.content_type === 'avatar' && approved && !manual) {
    const payload = task.payload as unknown as ModerationAvatarPayload
    await copyObject(
      payload.pendingKey,
      payload.avatarKey,
      AbortSignal.timeout(MODERATION_S3_TIMEOUT_MS)
    )
    await copyObject(
      payload.pendingMiniKey,
      payload.avatarMiniKey,
      AbortSignal.timeout(MODERATION_S3_TIMEOUT_MS)
    )
  }

  let claimed = false
  let ratingPatchId: number | null = null
  let resourcePatchId: number | null = null
  let commentApproved = false

  await prisma.$transaction(async (tx) => {
    // 先锁内容行再认领 task: 删除路径 (删内容行 → 删待审任务) 与 patch/user 级联
    // 删除都是内容行在前, 若这里先锁 task 行再改内容行会构成 AB-BA 死锁.
    // dry_run 与 m=1 转人工不改内容行, 不参与排序; 内容行已被删除时锁空集,
    // 后续查询自然落空
    if (!task.dry_run && !manual) {
      const contentId = task.content_id ?? 0
      switch (task.content_type) {
        case 'comment':
          await tx.$executeRaw`SELECT id FROM patch_comment WHERE id = ${contentId} FOR UPDATE`
          break
        case 'rating':
          await tx.$executeRaw`SELECT id FROM patch_rating WHERE id = ${contentId} FOR UPDATE`
          break
        case 'resource':
          await tx.$executeRaw`SELECT id FROM patch_resource WHERE id = ${contentId} FOR UPDATE`
          break
        case 'avatar':
        case 'bio':
          await tx.$executeRaw`SELECT id FROM "user" WHERE id = ${task.user_id} FOR UPDATE`
          break
      }
    }

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

    // m=1 转人工: 内容保持待审核, 不改内容也不通知, 等人工最终裁决
    if (manual) {
      return
    }

    switch (task.content_type) {
      case 'comment': {
        // 待审核 (1) 的评论: 通过转正常 (0), 拒绝转隐藏 (2)
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
        // 待审核 (1) 的评价: 通过转正常 (0), 拒绝转隐藏 (2)
        if (rating && rating.status === 1) {
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
        // 待审核 (3) 的资源: 通过转正常 (0), 拒绝转隐藏 (1)
        if (resource && resource.status === 3) {
          await tx.patch_resource.update({
            where: { id: task.content_id ?? 0 },
            data: { status: approved ? 0 : 1 }
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
            data: { avatar: payload.avatarLink, avatar_status: 0 }
          })
        } else {
          // pending 头像从未落地到 user.avatar (仍是旧头像), 拒绝时仅清除审核标记,
          // 保留用户原头像; pending S3 对象在提交后副作用中删除
          await tx.user.update({
            where: { id: task.user_id },
            data: { avatar_status: 0 }
          })
        }
        break
      }
      case 'bio': {
        const payload = task.payload as unknown as ModerationTextPayload
        if (approved) {
          await tx.user.update({
            where: { id: task.user_id },
            data: { bio: payload.bio ?? '', bio_status: 0 }
          })
        } else {
          // 新签名从未落地到 user.bio (仍是旧签名), 拒绝时仅清除审核标记, 保留原签名
          await tx.user.update({
            where: { id: task.user_id },
            data: { bio_status: 0 }
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
  // m=1 转人工: 无内容变更与副作用, task 已置 manual, 直接返回
  if (manual) {
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
    // approve: 新头像已复制到正式 key, 刷新 CDN
    if (approved) {
      await purgeCloudflareCache([
        `${imageBedUrl}/${payload.avatarKey}`,
        `${imageBedUrl}/${payload.avatarMiniKey}`
      ])
    }
    // pending 暂存对象无论通过与否都清理; 拒绝时用户原头像与正式 key 保持不动
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
