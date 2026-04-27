import { z } from 'zod'
import { prisma } from '~/prisma/index'
import {
  deletePatchResourceLink,
  recalcPatchType,
  sanitizeResourceLinksForAuditLog
} from '~/app/api/patch/resource/_helper'

const resourceIdSchema = z.object({
  resourceId: z.coerce
    .number({ message: '资源 ID 必须为数字' })
    .min(1)
    .max(9999999)
})

export const deleteResource = async (
  input: z.infer<typeof resourceIdSchema>,
  uid: number
) => {
  const admin = await prisma.user.findUnique({ where: { id: uid } })
  if (!admin) {
    return '未找到该管理员'
  }
  const patchResource = await prisma.patch_resource.findUnique({
    where: { id: input.resourceId },
    include: {
      patch: {
        select: {
          name: true
        }
      },
      links: true
    }
  })
  if (!patchResource) {
    return '未找到对应的资源'
  }

  const s3Links = patchResource.links.filter((link) => link.storage === 's3')

  const response = await prisma.$transaction(async (prisma) => {
    await prisma.patch_resource.delete({
      where: { id: input.resourceId }
    })
    await recalcPatchType(patchResource.patch_id, prisma)

    const sanitizedResource = {
      ...patchResource,
      links: sanitizeResourceLinksForAuditLog(patchResource.links)
    }
    await prisma.admin_log.create({
      data: {
        type: 'delete',
        user_id: uid,
        content: `管理员 ${admin.name} 删除了一个资源\n\nGalgame 名:\n${patchResource.patch.name}\n\n资源信息:\n${JSON.stringify(sanitizedResource)}`
      }
    })

    return {}
  })

  for (const link of s3Links) {
    await deletePatchResourceLink(
      link.content,
      patchResource.patch_id,
      link.hash
    )
  }

  return response
}
