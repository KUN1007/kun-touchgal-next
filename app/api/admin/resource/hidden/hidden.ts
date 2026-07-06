import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { recalcPatchType } from '~/app/api/patch/resource/_helper'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import { adminUpdateResourceHiddenSchema } from '~/validations/admin'

const statusLabel: Record<number, string> = {
  0: '正常',
  1: '屏蔽',
  3: '隐藏'
}

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

  const { resourceIds, status } = input
  // 仅在 0 (正常) / 1 (屏蔽) / 3 (隐藏) 之间流转, status=2 待审核永不被命中
  const fromStatuses = [0, 1, 3].filter((value) => value !== status)

  const targets = await prisma.patch_resource.findMany({
    where: { id: { in: resourceIds }, status: { in: fromStatuses } },
    select: { id: true, patch_id: true }
  })
  if (!targets.length) {
    return { count: 0 }
  }

  const targetIds = targets.map((resource) => resource.id)
  const patchIds = [...new Set(targets.map((resource) => resource.patch_id))]

  await prisma.$transaction(async (prisma) => {
    await prisma.patch_resource.updateMany({
      where: { id: { in: targetIds }, status: { in: fromStatuses } },
      data: { status }
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
          `管理员 ${admin.name} 批量将 ${targetIds.length} 条资源状态修改为 ${statusLabel[status]}\n资源 ID: ${targetIds.join(', ')}`
        )
      }
    })
  })

  await invalidateResourceListCache()

  return { count: targetIds.length }
}
