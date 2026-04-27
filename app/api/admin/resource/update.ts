import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { updatePatchResource as updatePatchResourceByRole } from '~/app/api/patch/resource/update'
import { sanitizeResourceLinksForAuditLog } from '~/app/api/patch/resource/_helper'
import { patchResourceUpdateSchema } from '~/validations/patch'

export const updatePatchResource = async (
  input: z.infer<typeof patchResourceUpdateSchema>,
  uid: number
) => {
  const admin = await prisma.user.findUnique({ where: { id: uid } })
  if (!admin) {
    return '未找到该管理员'
  }

  const { resourceId } = input
  const resource = await prisma.patch_resource.findUnique({
    where: { id: resourceId }
  })
  if (!resource) {
    return '未找到该资源'
  }

  const updatedResource = await updatePatchResourceByRole(input, uid, 3)
  if (typeof updatedResource === 'string') {
    return updatedResource
  }

  const sanitizedUpdated = {
    ...updatedResource,
    links: sanitizeResourceLinksForAuditLog(updatedResource.links)
  }

  return await prisma.$transaction(async (prisma) => {
    await prisma.admin_log.create({
      data: {
        type: 'update',
        user_id: uid,
        content: `管理员 ${admin.name} 更新了一个资源信息\n\n原资源信息:\n${JSON.stringify(resource)}\n\n新资源信息:\n${JSON.stringify(sanitizedUpdated)}`
      }
    })

    return updatedResource
  })
}
