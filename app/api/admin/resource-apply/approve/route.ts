import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { createMessage } from '~/app/api/utils/message'
import { kunParsePutBody } from '~/app/api/utils/parseQuery'
import { approvePatchResourceSchema } from '~/validations/admin'

export const approvePatchResource = async (
  input: z.infer<typeof approvePatchResourceSchema>,
  adminUid: number
) => {
  const { resourceId } = input

  const resource = await prisma.patch_resource.findUnique({
    where: { id: resourceId },
    include: {
      user: true,
      patch: true
    }
  })
  if (!resource) {
    return '该资源不存在'
  }
  if (resource.status !== 2) {
    return '当前资源状态无需审核'
  }

  const admin = await prisma.user.findUnique({ where: { id: adminUid } })
  if (!admin) {
    return '管理员不存在'
  }

  return prisma.$transaction(async (prisma) => {
    await prisma.patch_resource.update({
      where: { id: resourceId },
      data: { status: { set: 0 } }
    })

    await createMessage({
      type: 'system',
      content: `你上传的资源「${resource.name || resource.patch.name}」已通过审核，感谢你的分享！`,
      recipient_id: resource.user_id,
      link: `/${resource.patch.unique_id}`
    })

    await prisma.admin_log.create({
      data: {
        type: 'approve',
        user_id: adminUid,
        content: `管理员 ${admin.name} 审核通过了一条补丁资源\n\nGalgame 名称:${resource.patch.name}\n资源 ID:${resource.id}\n资源标题:${resource.name}\n上传用户:${resource.user.name}`
      }
    })

    return {}
  })
}

export const PUT = async (req: NextRequest) => {
  const input = await kunParsePutBody(req, approvePatchResourceSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('未登录')
  }
  if (payload.role < 3) {
    return NextResponse.json('权限不足')
  }

  const response = await approvePatchResource(input, payload.uid)
  return NextResponse.json(response)
}
