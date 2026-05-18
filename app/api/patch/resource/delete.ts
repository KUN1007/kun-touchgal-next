import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { deletePatchResourceLink, recalcPatchType } from './_helper'

const resourceIdSchema = z.object({
  resourceId: z.coerce
    .number({ message: '资源 ID 必须为数字' })
    .min(1)
    .max(9999999)
})

export const deleteResource = async (
  input: z.infer<typeof resourceIdSchema>,
  uid: number,
  userRole: number
) => {
  const patchResource = await prisma.patch_resource.findUnique({
    where: { id: input.resourceId },
    include: {
      links: true
    }
  })
  if (!patchResource) {
    return '未找到对应的资源'
  }

  const resourceUserUid = patchResource.user_id
  if (patchResource.user_id !== uid && userRole < 3) {
    return '您没有权限删除该资源'
  }

  const s3Links = patchResource.links.filter((link) => link.storage === 's3')

  const response = await prisma.$transaction(async (prisma) => {
    await prisma.user.update({
      where: { id: resourceUserUid },
      data: { moemoepoint: { increment: -3 } }
    })

    await prisma.patch_resource.delete({
      where: { id: input.resourceId }
    })
    await recalcPatchType(patchResource.patch_id, prisma)
    return {}
  })

  for (const link of s3Links) {
    await deletePatchResourceLink(
      link.content,
      patchResource.patch_id,
      link.hash,
      link.s3_key
    )
  }

  return response
}
