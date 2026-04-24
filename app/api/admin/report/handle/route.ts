import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { adminHandleReportSchema } from '~/validations/admin'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { recomputePatchRatingStat } from '~/app/api/patch/rating/stat'

const handleReport = async (
  input: z.infer<typeof adminHandleReportSchema>,
  handlerId: number
) => {
  const report = await prisma.patch_report.findUnique({
    where: { id: input.reportId },
    select: {
      id: true,
      status: true,
      target_type: true,
      reason: true,
      comment_id: true,
      rating_id: true,
      patch_id: true
    }
  })
  if (!report) {
    return '该举报不存在'
  }
  if (report.status !== 0) {
    return '该举报已被处理'
  }

  const targetType = report.target_type as 'comment' | 'rating'
  const targetId =
    targetType === 'comment' ? report.comment_id : report.rating_id

  if (input.action === 'delete' && !targetId) {
    return '被举报内容已不存在'
  }

  const defaultReply = input.action === 'reject' ? '已驳回' : '已处理'
  const handlerReply = input.content ? input.content : defaultReply
  const nextStatus = input.action === 'reject' ? 3 : 2
  const reportResult =
    input.action === 'reject' ? '您的举报已驳回' : '您的举报已处理'
  const reportReplyLabel = input.action === 'reject' ? '驳回回复' : '处理回复'

  const relatedWhere = targetId
    ? {
        status: 0,
        target_type: targetType,
        ...(targetType === 'comment'
          ? { comment_id: targetId }
          : { rating_id: targetId })
      }
    : {
        id: report.id,
        status: 0
      }

  const ratingPatchId =
    input.action === 'delete' && targetType === 'rating'
      ? report.patch_id
      : undefined

  await prisma.$transaction(async (tx) => {
    // Collect related reports BEFORE deleting the target. Deleting the target
    // triggers ON DELETE SET NULL on patch_report.comment_id / rating_id, which
    // would cause the subsequent lookup by comment_id / rating_id to miss
    // everything, leaving the reports stuck in pending with no notifications.
    const relatedReports = await tx.patch_report.findMany({
      where: relatedWhere,
      select: { id: true, sender_id: true, reason: true }
    })

    if (input.action === 'delete' && targetId) {
      if (targetType === 'comment') {
        await tx.patch_comment.deleteMany({ where: { id: targetId } })
      } else {
        await tx.patch_rating.deleteMany({ where: { id: targetId } })
      }
    }

    const reportIds = relatedReports.map((r) => r.id)
    if (reportIds.length) {
      await tx.patch_report.updateMany({
        where: { id: { in: reportIds } },
        data: {
          status: nextStatus,
          handler_id: handlerId,
          handler_reply: handlerReply,
          handled_at: new Date()
        }
      })
    }

    const recipientIds = [...new Set(relatedReports.map((r) => r.sender_id))]
    if (recipientIds.length) {
      await tx.user_message.createMany({
        data: recipientIds.map((recipientId) => {
          const senderReport = relatedReports.find(
            (r) => r.sender_id === recipientId
          )
          const reason = senderReport?.reason ?? ''
          const content = `${reportResult}\n\n举报原因：${reason.slice(0, 200)}\n${reportReplyLabel}：${handlerReply}`
          return {
            type: 'report',
            content,
            recipient_id: recipientId,
            link: '/'
          }
        })
      })
    }
  })

  if (ratingPatchId) {
    await recomputePatchRatingStat(ratingPatchId)
  }

  return {}
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, adminHandleReportSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }
  if (payload.role < 4) {
    return NextResponse.json('本页面仅超级管理员可访问')
  }

  const response = await handleReport(input, payload.uid)
  return NextResponse.json(response)
}
