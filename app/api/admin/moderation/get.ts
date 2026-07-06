import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { adminModerationPaginationSchema } from '~/validations/admin'
import type { AdminModerationTask } from '~/types/api/admin'

export const getModerationTasks = async (
  input: z.infer<typeof adminModerationPaginationSchema>
) => {
  const { page, limit, status } = input
  const offset = (page - 1) * limit
  const where = status === 'all' ? {} : { status }

  const [data, total] = await Promise.all([
    prisma.moderation_task.findMany({
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
        }
      }
    }),
    prisma.moderation_task.count({ where })
  ])

  const tasks: AdminModerationTask[] = data.map((task) => ({
    id: task.id,
    contentType: task.content_type,
    contentId: task.content_id,
    status: task.status,
    rejectCode: task.reject_code,
    rejectReason: task.reject_reason,
    payload: task.payload as AdminModerationTask['payload'],
    verdict: task.verdict,
    model: task.model,
    tokensIn: task.tokens_in,
    tokensOut: task.tokens_out,
    retry: task.retry,
    dryRun: task.dry_run,
    user: task.user,
    created: task.created,
    reviewed: task.reviewed
  }))

  return { tasks, total }
}
