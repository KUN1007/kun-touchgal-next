import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { patchCommentUpdateSchema } from '~/validations/patch'
import {
  COMMENT_HTML_VERSION,
  markdownToHtmlComment
} from '~/app/api/utils/render/markdownToHtmlComment'
import {
  MODERATION_SKIP,
  createModerationTask,
  hasPendingModeration,
  preScreenText
} from '~/server/moderation/submit'

export const updateComment = async (
  input: z.infer<typeof patchCommentUpdateSchema>,
  uid: number,
  userRole: number
) => {
  const { commentId, content, isSpoiler } = input

  const comment = await prisma.patch_comment.findUnique({
    where: { id: commentId }
  })
  // 隐藏 (status=2) 的评论仅后台可管理, 前端与不存在等同
  if (!comment || comment.status === 2) {
    return '未找到该评论'
  }
  const commentUserUid = comment.user_id
  if (comment.user_id !== uid && userRole < 3) {
    return '您没有权限更改该评论'
  }
  if (
    userRole < 3 &&
    (await hasPendingModeration('comment', { contentId: commentId }))
  ) {
    return '您发布的评论正在审核中, 暂时无法修改'
  }
  // status=1 (屏蔽): 管理员 shadow ban 不产生审核任务, 上面的 hasPendingModeration
  // 拦不住; 若放行编辑会重新送审, AI 通过后 status 1→0 静默解除管理员的封禁
  if (userRole < 3 && comment.status === 1) {
    return '您发布的评论正在审核中, 暂时无法修改'
  }

  let contentHtml = ''
  let contentHtmlVersion = 0
  try {
    contentHtml = await markdownToHtmlComment(content)
    contentHtmlVersion = COMMENT_HTML_VERSION
  } catch {
    contentHtml = ''
    contentHtmlVersion = 0
  }

  // 编辑正文后必须重新送审, 否则先发正常内容再改成违规即可绕过审核
  const moderation =
    comment.content !== content ? await preScreenText(content) : MODERATION_SKIP

  await prisma.$transaction(async (tx) => {
    await tx.patch_comment.update({
      where: { id: commentId, user_id: commentUserUid },
      data: {
        content,
        content_html: contentHtml,
        content_html_version: contentHtmlVersion,
        is_spoiler: isSpoiler,
        edit: Date.now().toString(),
        ...(moderation.intercept ? { status: 1 } : {})
      },
      include: {
        user: true,
        like_by: {
          include: {
            user: true
          }
        }
      }
    })

    if (moderation.queue) {
      await createModerationTask(
        {
          contentType: 'comment',
          contentId: commentId,
          userId: commentUserUid,
          payload: { text: content },
          dryRun: moderation.dryRun
        },
        tx
      )
    }
  })
  return {}
}
