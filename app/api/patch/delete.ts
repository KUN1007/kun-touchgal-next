import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { deletePatchResourceLink } from './resource/_helper'
import { invalidateResourceListCache } from '~/app/api/resource/cache'

const patchIdSchema = z.object({
  patchId: z.coerce.number().min(1).max(9999999)
})

export const deletePatchById = async (input: z.infer<typeof patchIdSchema>) => {
  const { patchId } = input

  const patch = await prisma.patch.findUnique({
    where: { id: patchId }
  })
  if (!patch) {
    return '未找到该游戏'
  }

  const patchResources = await prisma.patch_resource.findMany({
    where: { patch_id: patchId },
    include: {
      links: true
    }
  })

  const s3Links = patchResources.flatMap((resource) =>
    resource.links
      .filter((link) => link.storage === 's3')
      .map((link) => ({
        content: link.content,
        patchId: resource.patch_id,
        hash: link.hash,
        s3Key: link.s3_key
      }))
  )

  const response = await prisma.$transaction(async (prisma) => {
    if (patchResources.length > 0) {
      await Promise.all(
        patchResources.map(async (resource) => {
          await prisma.patch_resource.delete({
            where: { id: resource.id }
          })
        })
      )
    }

    await prisma.patch.delete({
      where: { id: patchId }
    })

    return {}
  })

  if (
    patchResources.some(
      (resource) => resource.status === 0 && resource.section === 'patch'
    )
  ) {
    await invalidateResourceListCache()
  }

  for (const link of s3Links) {
    await deletePatchResourceLink(
      link.content,
      link.patchId,
      link.hash,
      link.s3Key
    )
  }

  return response
}
