import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { patchCommentUpdateSchema } from '~/validations/patch'
import {
  COMMENT_HTML_VERSION,
  markdownToHtmlComment
} from '~/app/api/utils/render/markdownToHtmlComment'

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

  let contentHtml = ''
  let contentHtmlVersion = 0
  try {
    contentHtml = await markdownToHtmlComment(content)
    contentHtmlVersion = COMMENT_HTML_VERSION
  } catch {
    contentHtml = ''
    contentHtmlVersion = 0
  }

  await prisma.patch_comment.update({
    where: { id: commentId, user_id: commentUserUid },
    data: {
      content,
      content_html: contentHtml,
      content_html_version: contentHtmlVersion,
      is_spoiler: isSpoiler,
      edit: Date.now().toString()
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
  return {}
}
