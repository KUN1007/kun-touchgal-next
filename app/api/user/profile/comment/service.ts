import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { getUserInfoSchema } from '~/validations/user'
import { markdownToText } from '~/utils/markdownToText'
import {
  getShadowBanWhere,
  isShadowBanExemptViewer,
  type KunViewer
} from '~/app/api/utils/shadowBan'
import type { UserComment } from '~/types/api/user'

export const getUserComment = async (
  input: z.infer<typeof getUserInfoSchema>,
  viewer: KunViewer
) => {
  const { uid, page, limit } = input
  const offset = (page - 1) * limit
  const shadowBanWhere = getShadowBanWhere(viewer)

  const [data, total] = await Promise.all([
    prisma.patch_comment.findMany({
      where: { user_id: uid, ...shadowBanWhere },
      include: {
        user: true,
        patch: true,
        parent: {
          include: {
            user: true
          }
        },
        like_by: {
          include: {
            user: true
          }
        }
      },
      orderBy: { created: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.patch_comment.count({
      where: { user_id: uid, ...shadowBanWhere }
    })
  ])

  const comments: UserComment[] = data.map((comment) => {
    // 父评论被屏蔽时对非豁免 viewer 隐藏引用信息
    const parentVisible =
      !!comment.parent &&
      (comment.parent.status === 0 ||
        isShadowBanExemptViewer(viewer, comment.parent.user_id))

    return {
      id: comment.id,
      patchUniqueId: comment.patch.unique_id,
      content: markdownToText(comment.content).slice(0, 233),
      like: comment.like_by.length,
      userId: comment.user_id,
      patchId: comment.patch_id,
      patchName: comment.patch.name,
      created: String(comment.created),
      quotedUserUid: parentVisible ? comment.parent?.user.id : undefined,
      quotedUsername: parentVisible ? comment.parent?.user.name : undefined
    }
  })

  return { comments, total }
}
