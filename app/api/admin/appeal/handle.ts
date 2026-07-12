import { z } from 'zod'
import { prisma } from '~/prisma/index'
import type { moderation_appealModel } from '~/prisma/generated/prisma/models'
import { adminHandleAppealSchema } from '~/validations/admin'
import {
  COMMENT_HTML_VERSION,
  markdownToHtmlComment
} from '~/app/api/utils/render/markdownToHtmlComment'
import { createMessage } from '~/app/api/utils/message'
import { sendDeferredCommentNotifications } from '~/server/moderation/apply'
import { recomputePatchRatingStat } from '~/app/api/patch/rating/stat'
import { recalcPatchType } from '~/app/api/patch/resource/_helper'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import { invalidatePatchCommentCache } from '~/app/api/patch/comment/cache'
import { queueSearchSync } from '~/server/search/sync'
import { deleteComment as adminDeleteComment } from '~/app/api/admin/comment/delete'
import { deleteRating as adminDeleteRating } from '~/app/api/admin/rating/delete'
import { deleteResource as adminDeleteResource } from '~/app/api/admin/resource/delete'
import { APPEAL_RESULT_NOTICE, APPEAL_SETTINGS_LINK } from '~/constants/appeal'
import { MODERATION_CONTENT_TYPE_MAP } from '~/constants/moderation'
import type { AppealPayload } from '~/types/api/appeal'

// 事务内的业务失败, 回滚后将错误消息返回给管理员
class AppealHandleError extends Error {}

const approveAppeal = async (
  appeal: moderation_appealModel,
  adminName: string,
  uid: number
) => {
  const type = appeal.content_type
  const contentId = appeal.content_id
  const payload = appeal.payload as AppealPayload

  // 事务外预取副作用所需的 patch_id 并渲染评论 HTML
  let patchId: number | null = null
  let contentHtml = ''
  let contentHtmlVersion = 0
  if (type === 'comment') {
    try {
      contentHtml = await markdownToHtmlComment(payload.text ?? '')
      contentHtmlVersion = COMMENT_HTML_VERSION
    } catch {
      contentHtml = ''
      contentHtmlVersion = 0
    }
    const comment = await prisma.patch_comment.findUnique({
      where: { id: contentId },
      select: { patch_id: true }
    })
    patchId = comment?.patch_id ?? null
  } else if (type === 'rating') {
    const rating = await prisma.patch_rating.findUnique({
      where: { id: contentId },
      select: { patch_id: true }
    })
    patchId = rating?.patch_id ?? null
  } else {
    const resource = await prisma.patch_resource.findUnique({
      where: { id: contentId },
      select: { patch_id: true }
    })
    patchId = resource?.patch_id ?? null
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 以申诉行状态迁移作为幂等闸门, 防止并发重复处理
      const claim = await tx.moderation_appeal.updateMany({
        where: { id: appeal.id, status: 'pending' },
        data: { status: 'approved', handled_by: uid }
      })
      if (claim.count === 0) {
        throw new AppealHandleError('该申诉已被处理, 请刷新后重试')
      }

      // 仅对仍处于隐藏状态的内容生效, 不覆盖其他管理操作的结果
      let updatedCount = 0
      if (type === 'comment') {
        const updated = await tx.patch_comment.updateMany({
          where: { id: contentId, status: 2 },
          data: {
            content: payload.text ?? '',
            content_html: contentHtml,
            content_html_version: contentHtmlVersion,
            edit: Date.now().toString(),
            status: 0
          }
        })
        updatedCount = updated.count
      } else if (type === 'rating') {
        const updated = await tx.patch_rating.updateMany({
          where: { id: contentId, status: 2 },
          data: { short_summary: payload.text ?? '', status: 0 }
        })
        updatedCount = updated.count
      } else {
        const updated = await tx.patch_resource.updateMany({
          where: { id: contentId, status: 1 },
          data: {
            name: payload.name ?? '',
            note: payload.note ?? '',
            status: 0
          }
        })
        updatedCount = updated.count
        if (updated.count > 0 && patchId !== null) {
          await recalcPatchType(patchId, tx)
        }
      }
      if (updatedCount === 0) {
        throw new AppealHandleError(
          '内容已不存在或状态已变更, 无法通过, 可拒绝该申诉以关闭'
        )
      }

      if (type === 'rating' && patchId !== null) {
        await recomputePatchRatingStat(patchId, tx)
      }

      await createMessage(
        {
          type: 'system',
          content: APPEAL_RESULT_NOTICE.approved(
            MODERATION_CONTENT_TYPE_MAP[type]
          ),
          link: APPEAL_SETTINGS_LINK,
          recipient_id: appeal.user_id
        },
        tx
      )

      await tx.admin_log.create({
        data: {
          type: 'approve',
          user_id: uid,
          content: `管理员 ${adminName} 通过了申诉 (ID: ${appeal.id}, 类型: ${type}, 内容 ID: ${contentId}, 用户 ID: ${appeal.user_id}), 内容已恢复展示`
        }
      })
    })
  } catch (error) {
    if (error instanceof AppealHandleError) {
      return error.message
    }
    throw error
  }

  // 事务提交后的副作用, 与 AI 审核通过路径保持一致
  if (type === 'comment') {
    await sendDeferredCommentNotifications(contentId)
    if (patchId !== null) {
      await invalidatePatchCommentCache(patchId)
    }
  }
  if (type === 'resource') {
    if (patchId !== null) {
      queueSearchSync(patchId)
    }
    await invalidateResourceListCache()
  }

  return {}
}

const rejectAppeal = async (
  appeal: moderation_appealModel,
  adminName: string,
  uid: number
) => {
  const type = appeal.content_type
  const contentId = appeal.content_id

  // 先抢占状态: 防止并发重复处理, 也避免删除服务内的
  // deletePendingAppeals 清理钩子删掉本行申诉记录
  const claim = await prisma.moderation_appeal.updateMany({
    where: { id: appeal.id, status: 'pending' },
    data: { status: 'rejected', handled_by: uid }
  })
  if (claim.count === 0) {
    return '该申诉已被处理, 请刷新后重试'
  }

  // 仅删除仍处于隐藏状态的内容; 已被其他途径恢复的内容不删除, 只关闭申诉
  let contentStatus: number | null = null
  if (type === 'comment') {
    const comment = await prisma.patch_comment.findUnique({
      where: { id: contentId },
      select: { status: true }
    })
    contentStatus = comment?.status ?? null
  } else if (type === 'rating') {
    const rating = await prisma.patch_rating.findUnique({
      where: { id: contentId },
      select: { status: true }
    })
    contentStatus = rating?.status ?? null
  } else {
    const resource = await prisma.patch_resource.findUnique({
      where: { id: contentId },
      select: { status: true }
    })
    contentStatus = resource?.status ?? null
  }
  const hiddenStatus = type === 'resource' ? 1 : 2
  const contentHidden = contentStatus === hiddenStatus

  // 抢占后删除前发生任何失败, 都还原申诉为待处理, 避免"已拒绝但内容仍在"的不一致;
  // 但内容若已被并发删除 (如整个 patch 被删), 则保持 rejected —— 复活 pending 只会造孤儿申诉
  const revertClaim = async () => {
    const contentExists =
      type === 'comment'
        ? !!(await prisma.patch_comment.findUnique({
            where: { id: contentId },
            select: { id: true }
          }))
        : type === 'rating'
          ? !!(await prisma.patch_rating.findUnique({
              where: { id: contentId },
              select: { id: true }
            }))
          : !!(await prisma.patch_resource.findUnique({
              where: { id: contentId },
              select: { id: true }
            }))
    if (!contentExists) {
      return
    }
    await prisma.moderation_appeal.updateMany({
      where: { id: appeal.id, status: 'rejected' },
      data: { status: 'pending', handled_by: null }
    })
  }

  // 仅删除仍处于隐藏状态的内容; 已被其他途径恢复为可见的内容不删除, 只关闭申诉
  let contentDeleted = false
  if (contentHidden) {
    try {
      const res =
        type === 'comment'
          ? await adminDeleteComment({ commentIds: [contentId] }, uid)
          : type === 'rating'
            ? await adminDeleteRating({ ratingIds: [contentId] }, uid)
            : await adminDeleteResource({ resourceId: contentId }, uid)
      // "未找到" 表示内容已被并发删除, 视为达到目标状态; 其他错误消息还原抢占
      if (typeof res === 'string' && !res.startsWith('未找到')) {
        await revertClaim()
        return res
      }
    } catch (error) {
      await revertClaim()
      throw error
    }
    contentDeleted = true
  } else if (contentStatus === null) {
    // 内容已被其他途径删除, 与拒绝目标一致
    contentDeleted = true
  }

  await createMessage({
    type: 'system',
    content: contentDeleted
      ? APPEAL_RESULT_NOTICE.rejected(MODERATION_CONTENT_TYPE_MAP[type])
      : APPEAL_RESULT_NOTICE.rejectedKept(MODERATION_CONTENT_TYPE_MAP[type]),
    link: '',
    recipient_id: appeal.user_id
  })

  await prisma.admin_log.create({
    data: {
      type: 'decline',
      user_id: uid,
      content: `管理员 ${adminName} 拒绝了申诉 (ID: ${appeal.id}, 类型: ${type}, 内容 ID: ${contentId}, 用户 ID: ${appeal.user_id})${contentDeleted ? ', 内容已删除' : ', 内容已被其他操作处理, 未执行删除'}`
    }
  })

  return {}
}

export const handleAppeal = async (
  input: z.infer<typeof adminHandleAppealSchema>,
  uid: number
) => {
  const admin = await prisma.user.findUnique({ where: { id: uid } })
  if (!admin) {
    return '未找到该管理员'
  }

  const appeal = await prisma.moderation_appeal.findUnique({
    where: { id: input.appealId }
  })
  if (!appeal) {
    return '未找到该申诉'
  }
  if (appeal.status !== 'pending') {
    return '该申诉已被处理'
  }

  return input.approve
    ? approveAppeal(appeal, admin.name, uid)
    : rejectAppeal(appeal, admin.name, uid)
}
