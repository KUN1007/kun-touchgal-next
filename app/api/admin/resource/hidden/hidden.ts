import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { recalcPatchType } from '~/app/api/patch/resource/_helper'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import { adminUpdateResourceHiddenSchema } from '~/validations/admin'

const adminLogContentLimit = 10007

const truncateLogContent = (content: string) => {
  if (content.length <= adminLogContentLimit) {
    return content
  }

  return `${content.slice(0, adminLogContentLimit - 15)}...(truncated)`
}

export const updateResourceHidden = async (
  input: z.infer<typeof adminUpdateResourceHiddenSchema>,
  uid: number
) => {
  const admin = await prisma.user.findUnique({ where: { id: uid } })
  if (!admin) {
    return '未找到该管理员'
  }

  const { resourceIds, hidden } = input
  // 屏蔽: 仅 0 -> 1；取消屏蔽: 仅 1 -> 0。status=2 待审核永不被命中
  const fromStatus = hidden ? 0 : 1
  const toStatus = hidden ? 1 : 0

  const targets = await prisma.patch_resource.findMany({
    where: { id: { in: resourceIds }, status: fromStatus },
    select: { id: true, patch_id: true }
  })
  if (!targets.length) {
    return { count: 0 }
  }

  const targetIds = targets.map((resource) => resource.id)
  const patchIds = [...new Set(targets.map((resource) => resource.patch_id))]

  await prisma.$transaction(async (prisma) => {
    await prisma.patch_resource.updateMany({
      where: { id: { in: targetIds }, status: fromStatus },
      data: { status: toStatus }
    })

    // 资源可见性改变, 重算受影响补丁的 type/language/platform 聚合标签
    // 与 create/update/delete/approve 等既有流程保持一致
    for (const patchId of patchIds) {
      await recalcPatchType(patchId, prisma)
    }

    await prisma.admin_log.create({
      data: {
        type: 'update',
        user_id: uid,
        content: truncateLogContent(
          `管理员 ${admin.name} 批量${hidden ? '屏蔽' : '取消屏蔽'}了 ${targetIds.length} 条资源\n资源 ID: ${targetIds.join(', ')}`
        )
      }
    })
  })

  await invalidateResourceListCache()

  return { count: targetIds.length }
}
