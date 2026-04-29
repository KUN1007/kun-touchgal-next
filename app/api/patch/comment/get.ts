import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { Prisma } from '~/prisma/generated/prisma/client'
import { markdownToHtmlComment } from '~/app/api/utils/render/markdownToHtmlComment'
import { getPatchCommentSchema } from '~/validations/patch'
import type { PatchComment } from '~/types/api/patch'

export const getPatchComment = async (
  input: z.infer<typeof getPatchCommentSchema>,
  uid: number
) => {
  const { patchId, page, limit, commentId } = input
  type CommentLocator = {
    id: number
    patch_id: number
    parent_id: number | null
    created: Date
  }

  const findRootComment = async (targetCommentId: number) => {
    const rows = await prisma.$queryRaw<CommentLocator[]>`
      WITH RECURSIVE ancestors AS (
        SELECT id, patch_id, parent_id, created
        FROM patch_comment
        WHERE id = ${targetCommentId} AND patch_id = ${patchId}
        UNION ALL
        SELECT pc.id, pc.patch_id, pc.parent_id, pc.created
        FROM patch_comment pc
        INNER JOIN ancestors a ON pc.id = a.parent_id
        WHERE pc.patch_id = ${patchId}
      )
      SELECT id, patch_id, parent_id, created
      FROM ancestors
      WHERE parent_id IS NULL
      LIMIT 1
    `

    return rows[0] ?? null
  }

  let currentPage = page
  if (commentId) {
    const rootComment = await findRootComment(commentId)
    if (rootComment) {
      const commentsBeforeTargetRoot = await prisma.patch_comment.count({
        where: {
          patch_id: patchId,
          parent_id: null,
          OR: [
            { created: { gt: rootComment.created } },
            {
              AND: [
                { created: rootComment.created },
                { id: { gt: rootComment.id } }
              ]
            }
          ]
        }
      })

      currentPage = Math.floor(commentsBeforeTargetRoot / limit) + 1
    }
  }

  const total = await prisma.patch_comment.count({
    where: { patch_id: patchId, parent_id: null }
  })

  const rootComments = await prisma.patch_comment.findMany({
    where: { patch_id: patchId, parent_id: null },
    orderBy: [{ created: 'desc' }, { id: 'desc' }],
    skip: (currentPage - 1) * limit,
    take: limit,
    include: {
      user: true,
      patch: {
        select: {
          unique_id: true
        }
      },
      like_by: {
        where: {
          user_id: uid
        }
      },
      _count: {
        select: { like_by: true }
      }
    }
  })

  const rootIds = rootComments.map((c) => c.id)

  let descendantComments: typeof rootComments = []
  if (rootIds.length > 0) {
    const descendantIdRows = await prisma.$queryRaw<{ id: number }[]>`
      WITH RECURSIVE descendants AS (
        SELECT id, parent_id
        FROM patch_comment
        WHERE parent_id IN (${Prisma.join(rootIds)})
          AND patch_id = ${patchId}
        UNION ALL
        SELECT pc.id, pc.parent_id
        FROM patch_comment pc
        INNER JOIN descendants d ON pc.parent_id = d.id
        WHERE pc.patch_id = ${patchId}
      )
      SELECT id FROM descendants
    `
    const descendantIds = descendantIdRows.map((r) => r.id)

    if (descendantIds.length > 0) {
      descendantComments = await prisma.patch_comment.findMany({
        where: { id: { in: descendantIds } },
        include: {
          user: true,
          patch: {
            select: {
              unique_id: true
            }
          },
          like_by: {
            where: {
              user_id: uid
            }
          },
          _count: {
            select: { like_by: true }
          }
        }
      })
    }
  }

  const commentMap = new Map(
    [...rootComments, ...descendantComments].map((c) => [c.id, c])
  )
  const rootIdSet = new Set(rootIds)

  const findRootId = (commentId: number): number | null => {
    let cursor = commentMap.get(commentId)
    while (cursor && cursor.parent_id !== null) {
      cursor = commentMap.get(cursor.parent_id)
    }
    return cursor ? cursor.id : null
  }

  const replyMap = new Map<number, typeof descendantComments>()
  for (const comment of descendantComments) {
    const rootId = findRootId(comment.id)
    if (rootId !== null && rootIdSet.has(rootId)) {
      const bucket = replyMap.get(rootId)
      if (bucket) {
        bucket.push(comment)
      } else {
        replyMap.set(rootId, [comment])
      }
    }
  }

  const comments: PatchComment[] = await Promise.all(
    rootComments.map(async (comment) => {
      const replies = replyMap.get(comment.id) || []

      const replyComments: PatchComment[] = await Promise.all(
        replies
          .sort(
            (a, b) =>
              new Date(a.created).getTime() - new Date(b.created).getTime()
          )
          .map(async (reply) => {
            const directParent = commentMap.get(reply.parent_id!)
            const isReplyToRoot = reply.parent_id === comment.id

            return {
              id: reply.id,
              uniqueId: reply.patch.unique_id,
              content: await markdownToHtmlComment(reply.content),
              isLike: reply.like_by.length > 0,
              likeCount: reply._count.like_by,
              parentId: comment.id,
              userId: reply.user_id,
              patchId: reply.patch_id,
              created: String(reply.created),
              updated: String(reply.updated),
              reply: [],
              user: {
                id: reply.user.id,
                name: reply.user.name,
                avatar: reply.user.avatar
              },
              quotedContent: null,
              quotedUsername: null,
              replyToUser:
                !isReplyToRoot && directParent
                  ? {
                      id: directParent.user.id,
                      name: directParent.user.name,
                      avatar: directParent.user.avatar
                    }
                  : null
            }
          })
      )

      return {
        id: comment.id,
        uniqueId: comment.patch.unique_id,
        content: await markdownToHtmlComment(comment.content),
        isLike: comment.like_by.length > 0,
        likeCount: comment._count.like_by,
        parentId: null,
        userId: comment.user_id,
        patchId: comment.patch_id,
        created: String(comment.created),
        updated: String(comment.updated),
        reply: replyComments,
        user: {
          id: comment.user.id,
          name: comment.user.name,
          avatar: comment.user.avatar
        },
        quotedContent: null,
        quotedUsername: null,
        replyToUser: null
      }
    })
  )

  return { comments, total, currentPage }
}
