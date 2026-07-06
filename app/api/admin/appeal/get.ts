import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { adminAppealPaginationSchema } from '~/validations/admin'
import type { AdminAppealItem, AppealPayload } from '~/types/api/appeal'

export const getAppeals = async (
  input: z.infer<typeof adminAppealPaginationSchema>
) => {
  const { page, limit, status } = input
  const offset = (page - 1) * limit
  const where = status === 'all' ? {} : { status }

  const [data, total] = await Promise.all([
    prisma.moderation_appeal.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { created: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        },
        task: { select: { reject_reason: true } }
      }
    }),
    prisma.moderation_appeal.count({ where })
  ])

  const idsOf = (type: string) =>
    data
      .filter((appeal) => appeal.content_type === type)
      .map((appeal) => appeal.content_id)

  const [comments, ratings, resources] = await Promise.all([
    prisma.patch_comment.findMany({
      where: { id: { in: idsOf('comment') } },
      select: { id: true, content: true }
    }),
    prisma.patch_rating.findMany({
      where: { id: { in: idsOf('rating') } },
      select: { id: true, short_summary: true }
    }),
    prisma.patch_resource.findMany({
      where: { id: { in: idsOf('resource') } },
      select: { id: true, name: true, note: true }
    })
  ])

  const originalMap = new Map<string, AppealPayload>()
  for (const comment of comments) {
    originalMap.set(`comment:${comment.id}`, { text: comment.content })
  }
  for (const rating of ratings) {
    originalMap.set(`rating:${rating.id}`, { text: rating.short_summary })
  }
  for (const resource of resources) {
    originalMap.set(`resource:${resource.id}`, {
      name: resource.name,
      note: resource.note
    })
  }

  const appeals: AdminAppealItem[] = data.map((appeal) => ({
    id: appeal.id,
    contentType: appeal.content_type,
    contentId: appeal.content_id,
    status: appeal.status,
    payload: appeal.payload as AppealPayload,
    original:
      originalMap.get(`${appeal.content_type}:${appeal.content_id}`) ?? null,
    rejectReason: appeal.task.reject_reason,
    user: appeal.user,
    created: appeal.created,
    updated: appeal.updated
  }))

  return { appeals, total }
}
