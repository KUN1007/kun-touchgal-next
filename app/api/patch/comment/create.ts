import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { patchCommentCreateSchema } from '~/validations/patch'
import { createDedupMessage } from '~/app/api/utils/message'
import { createMentionMessage } from '~/app/api/utils/createMentionMessage'
import {
  COMMENT_HTML_VERSION,
  markdownToHtmlComment
} from '~/app/api/utils/render/markdownToHtmlComment'
import { createModerationTask, preScreenText } from '~/server/moderation/submit'
import type { PatchComment } from '~/types/api/patch'

export const createPatchComment = async (
  input: z.infer<typeof patchCommentCreateSchema>,
  uid: number
) => {
  let parentComment: {
    user_id: number
    content: string
    status: number
  } | null = null
  if (input.parentId) {
    parentComment = await prisma.patch_comment.findUnique({
      where: { id: input.parentId },
      select: { user_id: true, content: true, status: true }
    })
    if (!parentComment) {
      return '未找到该评论'
    }
    // 与读取可见性 (getShadowBanWhere 非管理员分支) 对齐: 仅 status=0, 或作者本人的
    // status=1 (shadow ban, 仅作者可见) 可回复; 他人的 status=1 与 status=2 (对所有人
    // 隐藏) 一律与不存在等同, 防止通过回复探测 shadow ban
    if (
      parentComment.status !== 0 &&
      !(parentComment.status === 1 && parentComment.user_id === uid)
    ) {
      return '未找到该评论'
    }
  }

  let contentHtml = ''
  let contentHtmlVersion = 0
  try {
    contentHtml = await markdownToHtmlComment(input.content)
    contentHtmlVersion = COMMENT_HTML_VERSION
  } catch {
    contentHtml = ''
    contentHtmlVersion = 0
  }

  const moderation = await preScreenText(input.content)

  const data = await prisma.$transaction(async (tx) => {
    const created = await tx.patch_comment.create({
      data: {
        content: input.content,
        content_html: contentHtml,
        content_html_version: contentHtmlVersion,
        is_spoiler: input.isSpoiler,
        status: moderation.intercept ? 1 : 0,
        user_id: uid,
        patch_id: input.patchId,
        parent_id: input.parentId
      },
      include: {
        patch: {
          select: {
            name: true,
            unique_id: true
          }
        },
        user: {
          select: {
            name: true
          }
        }
      }
    })

    if (moderation.queue) {
      await createModerationTask(
        {
          contentType: 'comment',
          contentId: created.id,
          userId: uid,
          payload: { text: input.content },
          dryRun: moderation.dryRun
        },
        tx
      )
    }

    return created
  })

  // 拦截时回复与提及通知由 apply.ts 在审核通过后补发
  if (!moderation.intercept) {
    if (parentComment && parentComment.user_id !== uid) {
      await createDedupMessage({
        type: 'comment',
        content: `回复了您的评论：${parentComment.content.slice(0, 107)}`,
        sender_id: uid,
        recipient_id: parentComment.user_id,
        link: `/${data.patch.unique_id}?tab=comments&commentId=${data.id}`
      })
    }

    await createMentionMessage(
      data.patch.unique_id,
      data.patch.name,
      data.id,
      uid,
      data.user.name,
      input.content
    )
  }

  const newComment: Omit<PatchComment, 'user'> = {
    id: data.id,
    uniqueId: data.patch?.unique_id ?? '',
    content:
      contentHtmlVersion === COMMENT_HTML_VERSION && contentHtml
        ? contentHtml
        : await markdownToHtmlComment(data.content),
    isLike: false,
    isSpoiler: data.is_spoiler,
    // status=1 (审核中) 对作者掩码为 0, 保持与正常发布一致
    status: data.status === 1 ? 0 : data.status,
    likeCount: 0,
    parentId: data.parent_id,
    userId: data.user_id,
    patchId: data.patch_id,
    reply: [],
    created: String(data.created),
    updated: String(data.updated)
  }

  return newComment
}
