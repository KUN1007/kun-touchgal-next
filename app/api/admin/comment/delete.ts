import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { Prisma } from '~/prisma/generated/prisma/client'
import { adminDeleteCommentSchema } from '~/validations/admin'
import { deletePendingModerationTasks } from '~/server/moderation/submit'

const adminLogContentLimit = 10007
const adminDeleteCommentSummaryLimit = 10
const adminDeleteCommentPreviewLimit = 100

const truncateLogContent = (content: string) => {
  if (content.length <= adminLogContentLimit) {
    return content
  }

  return `${content.slice(0, adminLogContentLimit - 15)}...(truncated)`
}

const buildDeleteLogContent = (
  adminName: string,
  comments: Array<{
    id: number
    user_id: number
    patch_id: number
    parent_id: number | null
    content: string
  }>
) => {
  const summaries = comments
    .slice(0, adminDeleteCommentSummaryLimit)
    .map((comment) => ({
      id: comment.id,
      userId: comment.user_id,
      patchId: comment.patch_id,
      parentId: comment.parent_id,
      contentPreview: comment.content.slice(0, adminDeleteCommentPreviewLimit)
    }))

  const suffix =
    comments.length > summaries.length
      ? `\n其余 ${comments.length - summaries.length} 条评论摘要已省略`
      : ''

  const content =
    comments.length > 1
      ? `管理员 ${adminName} 批量删除了 ${comments.length} 条评论\n评论 ID: ${comments
          .map((comment) => comment.id)
          .join(', ')}\n评论摘要: ${JSON.stringify(summaries)}${suffix}`
      : `管理员 ${adminName} 删除了一条评论\n评论详情: ${JSON.stringify(summaries[0])}`

  return truncateLogContent(content)
}

export const deleteComment = async (
  input: z.infer<typeof adminDeleteCommentSchema>,
  uid: number
) => {
  const comments = await prisma.patch_comment.findMany({
    where: {
      id: {
        in: input.commentIds
      }
    }
  })
  if (!comments.length) {
    return '未找到对应的评论'
  }

  const admin = await prisma.user.findUnique({ where: { id: uid } })
  if (!admin) {
    return '未找到该管理员'
  }

  return await prisma.$transaction(async (prisma) => {
    const targetIds = comments.map((comment) => comment.id)

    // 级联删除会带走整棵回复子树, 删除前先收集全部后代 id
    // 以清理它们尚未有最终裁决的审核任务
    const descendantRows = await prisma.$queryRaw<{ id: number }[]>`
      WITH RECURSIVE descendants AS (
        SELECT id FROM patch_comment WHERE id IN (${Prisma.join(targetIds)})
        UNION ALL
        SELECT pc.id FROM patch_comment pc
        INNER JOIN descendants d ON pc.parent_id = d.id
      )
      SELECT id FROM descendants
    `

    await prisma.patch_comment.deleteMany({
      where: {
        id: {
          in: targetIds
        }
      }
    })

    await deletePendingModerationTasks(
      'comment',
      descendantRows.map((row) => row.id),
      prisma
    )

    await prisma.admin_log.create({
      data: {
        type: 'delete',
        user_id: uid,
        content: buildDeleteLogContent(admin.name, comments)
      }
    })

    return {}
  })
}
