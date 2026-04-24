import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { createPatchCommentReportSchema } from '~/validations/patch'
import { prisma } from '~/prisma'

const createReport = async (
  input: z.infer<typeof createPatchCommentReportSchema>,
  uid: number
) => {
  const comment = await prisma.patch_comment.findUnique({
    where: { id: input.commentId },
    select: {
      id: true,
      user_id: true,
      patch_id: true
    }
  })
  if (!comment) {
    return '评论不存在'
  }
  if (comment.patch_id !== input.patchId) {
    return '评论不属于当前游戏'
  }
  if (comment.user_id === uid) {
    return '不能举报自己的评论'
  }

  const existingReport = await prisma.patch_report.findFirst({
    where: {
      target_type: 'comment',
      comment_id: comment.id,
      sender_id: uid,
      status: 0
    },
    select: { id: true }
  })
  if (existingReport) {
    return '您已经举报过该评论，请等待管理员处理'
  }

  await prisma.patch_report.create({
    data: {
      target_type: 'comment',
      reason: input.content,
      sender_id: uid,
      reported_user_id: comment.user_id,
      patch_id: comment.patch_id,
      comment_id: comment.id
    }
  })

  return {}
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, createPatchCommentReportSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const response = await createReport(input, payload.uid)
  return NextResponse.json(response)
}
