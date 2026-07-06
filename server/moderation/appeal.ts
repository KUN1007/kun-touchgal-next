import { prisma } from '~/prisma/index'
import type { Prisma } from '~/prisma/generated/prisma/client'
import type { AppealContentType } from '~/constants/appeal'

type ModerationClient = Prisma.TransactionClient | typeof prisma

// 删除内容时清理尚未处理的申诉, 已 approved/rejected 的申诉保留作历史记录
export const deletePendingAppeals = async (
  contentType: AppealContentType,
  contentId: number | number[],
  db: ModerationClient = prisma
) =>
  db.moderation_appeal.deleteMany({
    where: {
      content_type: contentType,
      content_id: Array.isArray(contentId) ? { in: contentId } : contentId,
      status: 'pending'
    }
  })
