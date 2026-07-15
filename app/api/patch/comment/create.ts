import { z } from 'zod'
import { convert } from 'html-to-text'
import { prisma } from '~/prisma/index'
import { patchCommentCreateSchema } from '~/validations/patch'
import { createDedupMessage } from '~/app/api/utils/message'
import { createMentionMessage } from '~/app/api/utils/createMentionMessage'
import {
  COMMENT_HTML_VERSION,
  markdownToHtmlComment
} from '~/app/api/utils/render/markdownToHtmlComment'
import { createModerationTask, preScreenText } from '~/server/moderation/submit'
import { invalidatePatchCommentCache } from './cache'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'
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
    // 待审核 (status=1) 的评论不可回复; 隐藏 (status=2) 的评论前端不可见, 与不存在等同
    if (parentComment.status === 1) {
      return '该评论正在审核中, 暂时无法回复'
    }
    if (parentComment.status !== 0) {
      return '未找到该评论'
    }
  }

  const [contentResult, moderation] = await Promise.all([
    (async () => {
      try {
        return {
          html: await markdownToHtmlComment(input.content),
          version: COMMENT_HTML_VERSION
        }
      } catch {
        return { html: '', version: 0 }
      }
    })(),
    preScreenText(input.content)
  ])
  const { html: contentHtml, version: contentHtmlVersion } = contentResult

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

  const renderedHtml =
    contentHtmlVersion === COMMENT_HTML_VERSION && contentHtml
      ? contentHtml
      : await markdownToHtmlComment(data.content)

  const newComment: Omit<PatchComment, 'user'> = {
    id: data.id,
    uniqueId: data.patch?.unique_id ?? '',
    content: renderedHtml,
    contentPreview: convert(renderedHtml).trim(),
    isLike: false,
    isSpoiler: data.is_spoiler,
    status: data.status,
    likeCount: 0,
    parentId: data.parent_id,
    userId: data.user_id,
    patchId: data.patch_id,
    reply: [],
    created: String(data.created),
    updated: String(data.updated)
  }

  await invalidatePatchCommentCache(input.patchId)
  // 新增评论改变 _count.comment, 失效补丁详情缓存 (M-05)
  await invalidatePatchContentCache(data.patch.unique_id).catch(() => undefined)

  return newComment
}
