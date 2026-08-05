import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { deletePendingModerationTasks } from '~/server/moderation/submit'
import { deletePendingAppeals } from '~/server/moderation/appeal'
import {
  collectPendingReportIds,
  deleteReportsByIds
} from '~/server/report/pending'
import { buildCommentLink } from '~/utils/patch/buildCommentLink'
import { collectCommentSubtreeIds } from './subtree'
import { invalidatePatchCommentCache } from './cache'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'
import type { Prisma } from '~/prisma/generated/prisma/client'

const commentIdSchema = z.object({
  commentId: z.coerce
    .number({ message: '评论 ID 必须为数字' })
    .min(1)
    .max(9999999)
})

type CommentDeleteClient = Prisma.TransactionClient | typeof prisma

interface CommentForDelete {
  id: number
  user_id: number
  parent_id: number | null
  resource_id: number | null
  patch: { unique_id: string }
  parent: { user_id: number } | null
  resource: { user_id: number } | null
}

const commentForDeleteSelect = {
  id: true,
  user_id: true,
  parent_id: true,
  resource_id: true,
  patch_id: true,
  status: true,
  patch: { select: { unique_id: true } },
  parent: { select: { user_id: true } },
  resource: { select: { user_id: true } }
} as const

const deleteCommentWithReplies = async (
  comment: CommentForDelete,
  db: CommentDeleteClient
) => {
  const childComments = await db.patch_comment.findMany({
    where: { parent_id: comment.id },
    select: commentForDeleteSelect
  })

  for (const child of childComments) {
    await deleteCommentWithReplies(child, db)
  }

  if (comment.parent_id && comment.parent) {
    await db.user_message.deleteMany({
      where: {
        type: 'comment',
        sender_id: comment.user_id,
        recipient_id: comment.parent.user_id,
        link: buildCommentLink(
          comment.patch.unique_id,
          comment.id,
          comment.resource_id
        )
      }
    })
  }

  // 资源一级评论: 清理发给资源上传者的通知
  if (!comment.parent_id && comment.resource_id && comment.resource) {
    await db.user_message.deleteMany({
      where: {
        type: 'comment',
        sender_id: comment.user_id,
        recipient_id: comment.resource.user_id,
        link: buildCommentLink(
          comment.patch.unique_id,
          comment.id,
          comment.resource_id
        )
      }
    })
  }

  await db.patch_comment.delete({
    where: { id: comment.id }
  })
}

export const deleteComment = async (
  input: z.infer<typeof commentIdSchema>,
  uid: number,
  userRole: number
) => {
  const comment = await prisma.patch_comment.findUnique({
    where: {
      id: input.commentId
    },
    select: commentForDeleteSelect
  })
  // 隐藏 (status=2) 的评论仅后台可管理, 前端与不存在等同
  if (!comment || comment.status === 2) {
    return '未找到对应的评论'
  }

  if (comment.user_id !== uid && userRole < 3) {
    return '您没有权限删除该评论'
  }
  // 待审核 (status=1) 的评论禁止作者删除; 管理员可删
  if (userRole < 3 && comment.status === 1) {
    return '该评论正在审核中, 暂时无法删除'
  }

  await prisma.$transaction(async (tx) => {
    // 删除前一次收集整棵回复子树的 id,
    // 统一清理尚未有最终裁决的审核任务
    const subtreeIds = await collectCommentSubtreeIds([comment.id], tx)

    // 举报外键是 SET NULL, 删除前先无锁收集 pending 举报主键, 删除后按主键清理
    const reportIds = await collectPendingReportIds('comment', subtreeIds, tx)

    await deleteCommentWithReplies(comment, tx)

    await deletePendingModerationTasks('comment', subtreeIds, tx)
    await deletePendingAppeals('comment', subtreeIds, tx)
    await deleteReportsByIds(reportIds, tx)
  })

  await invalidatePatchCommentCache(comment.patch_id)
  // 删除评论改变 _count.comment, 失效补丁详情缓存 (M-05);
  // 资源评论不计入 _count.comment, 无需失效
  if (!comment.resource_id) {
    await invalidatePatchContentCache(comment.patch.unique_id).catch(
      () => undefined
    )
  }
  return {}
}
