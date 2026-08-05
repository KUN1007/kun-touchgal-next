import { prisma } from '~/prisma/index'
import type { Prisma } from '~/prisma/generated/prisma/client'
import type { AdminReportTargetType } from '~/types/api/admin'

type ReportClient = Prisma.TransactionClient | typeof prisma

// 删除评论/评分时清理其尚未处理的举报, 已处理的举报保留作历史记录。
// patch_report.comment_id / rating_id 是 ON DELETE SET NULL, 内容删除后
// 无从按目标 id 匹配 (孤儿举报); 而删除前直接清理会持有举报行锁再等内容
// 行锁, 与级联 SET NULL 的「内容行→举报行」锁序相反, 可与并发的举报处理
// 死锁 —— 故拆两步: 删除前无锁收集主键, 删除后按主键清理

export const collectPendingReportIds = async (
  targetType: AdminReportTargetType,
  contentId: number | number[],
  db: ReportClient = prisma
) => {
  const idFilter = Array.isArray(contentId) ? { in: contentId } : contentId
  const reports = await db.patch_report.findMany({
    where: {
      target_type: targetType,
      status: 0,
      ...(targetType === 'comment'
        ? { comment_id: idFilter }
        : { rating_id: idFilter })
    },
    select: { id: true }
  })
  return reports.map((report) => report.id)
}

// status: 0 条件防误删收集间隙中已被并发处理 (转为历史记录) 的举报
export const deleteReportsByIds = async (
  reportIds: number[],
  db: ReportClient = prisma
) => {
  if (!reportIds.length) {
    return
  }
  await db.patch_report.deleteMany({
    where: { id: { in: reportIds }, status: 0 }
  })
}
