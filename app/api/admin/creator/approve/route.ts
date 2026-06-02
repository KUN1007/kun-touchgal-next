import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { createMessage } from '~/app/api/utils/message'
import { kunParsePutBody } from '~/app/api/utils/parseQuery'
import { approveCreatorSchema } from '~/validations/admin'
import { invalidateUserSession } from '~/app/api/user/session/cache'

const approveCreator = async (
  input: z.infer<typeof approveCreatorSchema>,
  adminUid: number
) => {
  const { messageId, uid } = input
  const message = await prisma.user_message.findUnique({
    where: { id: messageId }
  })
  if (!message) {
    return '未找到该创作者请求'
  }
  const creator = await prisma.user.findUnique({
    where: { id: message.sender_id ?? 0 },
    include: {
      _count: {
        select: {
          patch_resource: true
        }
      }
    }
  })
  if (!creator) {
    return '未找到该创作者'
  }
  const admin = await prisma.user.findUnique({ where: { id: adminUid } })
  if (!admin) {
    return '未找到该管理员'
  }

  const result = await prisma.$transaction(async (prisma) => {
    await prisma.user_message.update({
      where: { id: messageId },
      // status: 0 - unread, 1 - read, 2 - approve, 3 - decline
      data: { status: { set: 2 } }
    })

    await prisma.user.update({
      where: { id: uid },
      data: { role: { set: 2 } }
    })

    await createMessage({
      type: 'apply',
      content: '恭喜，您的创作者申请已通过！',
      recipient_id: message.sender_id ?? undefined,
      link: '/apply/success'
    })

    await prisma.admin_log.create({
      data: {
        type: 'approve',
        user_id: adminUid,
        content: `管理员 ${admin.name} 同意了一位创作者申请\n\n创作者信息:\n用户名:${creator.name}\n已发布资源数:${creator._count.patch_resource}`
      }
    })

    return {}
  })
  await invalidateUserSession(uid)
  return result
}

export const PUT = async (req: NextRequest) => {
  const input = await kunParsePutBody(req, approveCreatorSchema)
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

  const response = await approveCreator(input, payload.uid)
  return NextResponse.json(response)
}
