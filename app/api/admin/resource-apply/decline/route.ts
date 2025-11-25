import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { createMessage } from '~/app/api/utils/message'
import { kunParsePutBody } from '~/app/api/utils/parseQuery'
import { declinePatchResourceSchema } from '~/validations/admin'
import { deleteFileFromS3 } from '~/lib/s3'

export const declinePatchResource = async (
  input: z.infer<typeof declinePatchResourceSchema>,
  adminUid: number
) => {
  const { resourceId, reason } = input

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

  const admin = await prisma.user.findUnique({ where: { id: adminUid } })
  if (!admin) {
    return '管理员不存在'
  }

  if (resource.storage === 's3') {
    const fileName = resource.content.split('/').pop()
    const s3Key = `patch/${resource.patch_id}/${resource.hash}/${fileName}`
    await deleteFileFromS3(s3Key)
  }

  return prisma.$transaction(async (prisma) => {
    await prisma.patch_resource.delete({
      where: { id: resourceId }
    })

    await createMessage({
      type: 'system',
      content: `你上传的资源「${resource.name || resource.patch.name}」未通过审核，原因：${reason}`,
      recipient_id: resource.user_id,
      link: '/'
    })

    await prisma.admin_log.create({
      data: {
        type: 'decline',
        user_id: adminUid,
        content: `管理员 ${admin.name} 拒绝了一条补丁资源\n\n拒绝原因:${reason}\nGalgame 名称:${resource.patch.name}\n资源 ID:${resource.id}\n资源标题:${resource.name}\n上传用户:${resource.user.name}`
      }
    })

    return {}
  })
}

export const PUT = async (req: NextRequest) => {
  const input = await kunParsePutBody(req, declinePatchResourceSchema)
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

  const response = await declinePatchResource(input, payload.uid)
  return NextResponse.json(response)
}
