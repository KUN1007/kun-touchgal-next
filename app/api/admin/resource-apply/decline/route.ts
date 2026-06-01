import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { createMessage } from '~/app/api/utils/message'
import { kunParsePutBody } from '~/app/api/utils/parseQuery'
import { declinePatchResourceSchema } from '~/validations/admin'
import {
  deletePatchResourceLink,
  recalcPatchType
} from '~/app/api/patch/resource/_helper'
import { invalidateResourceListCache } from '~/app/api/resource/cache'

const declinePatchResource = async (
  input: z.infer<typeof declinePatchResourceSchema>,
  adminUid: number
) => {
  const { resourceId, reason } = input

  const resource = await prisma.patch_resource.findUnique({
    where: { id: resourceId },
    include: {
      user: true,
      patch: true,
      links: true
    }
  })
  if (!resource) {
    return '该资源不存在'
  }

  const admin = await prisma.user.findUnique({ where: { id: adminUid } })
  if (!admin) {
    return '管理员不存在'
  }

  const s3Links = resource.links.filter((link) => link.storage === 's3')

  const response = await prisma.$transaction(async (prisma) => {
    await prisma.patch_resource.delete({
      where: { id: resourceId }
    })
    await recalcPatchType(resource.patch_id, prisma)

    await createMessage({
      type: 'system',
      content: `您上传的资源「${resource.name || resource.patch.name}」未通过审核，原因：${reason}`,
      recipient_id: resource.user_id,
      link: `/${resource.patch.unique_id}?tab=resources&resourceSection=${resource.section}`
    })

    await prisma.admin_log.create({
      data: {
        type: 'decline',
        user_id: adminUid,
        content: `管理员 ${admin.name} 拒绝了一条资源\n\n拒绝原因:${reason}\nGalgame 名称:${resource.patch.name}\n资源 ID:${resource.id}\n资源标题:${resource.name}\n上传用户:${resource.user.name}`
      }
    })

    return {}
  })

  if (resource.section === 'patch' && resource.status === 0) {
    await invalidateResourceListCache()
  }

  for (const link of s3Links) {
    await deletePatchResourceLink(
      link.content,
      resource.patch_id,
      link.hash,
      link.s3_key
    )
  }

  return response
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
  if (payload.role < 4) {
    return NextResponse.json('仅超级管理员可访问')
  }

  const response = await declinePatchResource(input, payload.uid)
  return NextResponse.json(response)
}
