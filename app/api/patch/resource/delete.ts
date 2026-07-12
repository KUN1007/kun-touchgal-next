import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { deletePatchResourceLink, recalcPatchType } from './_helper'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import { invalidateUserSession } from '~/app/api/user/session/cache'
import { deletePendingModerationTasks } from '~/server/moderation/submit'
import { queueSearchSync } from '~/server/search/sync'

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
  // 隐藏 (status=1) 的资源仅后台可管理, 前端与不存在等同
  if (!patchResource || patchResource.status === 1) {
    return '未找到对应的资源'
  }

  const resourceUserUid = patchResource.user_id
  if (patchResource.user_id !== uid && userRole < 3) {
    return '您没有权限删除该资源'
  }
  // 待初次审核 (status=2) / 待审核 (status=3) 的资源禁止作者删除; 管理员可删
  if (userRole < 3 && patchResource.status !== 0) {
    return '该资源正在审核中, 暂时无法删除'
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
    await deletePendingModerationTasks('resource', input.resourceId, prisma)
    await recalcPatchType(patchResource.patch_id, prisma)
    return {}
  })

  queueSearchSync(patchResource.patch_id)
  await invalidateUserSession(resourceUserUid)

  if (patchResource.status === 0 && patchResource.section === 'patch') {
    await invalidateResourceListCache()
  }

  await Promise.all(
    s3Links.map((link) =>
      deletePatchResourceLink(
        link.content,
        patchResource.patch_id,
        link.hash,
        link.s3_key
      )
    )
  )

  return response
}
