import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { deletePatchResourceLink } from './resource/_helper'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import { deletePendingModerationTasks } from '~/server/moderation/submit'
import { deletePendingAppeals } from '~/server/moderation/appeal'
import { queueSearchRemove } from '~/server/search/sync'

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
    // 级联删除会带走该游戏的全部评论/评价, 先收集 id 供删除后清理未决审核任务与申诉
    const [comments, ratings] = await Promise.all([
      prisma.patch_comment.findMany({
        where: { patch_id: patchId },
        select: { id: true }
      }),
      prisma.patch_rating.findMany({
        where: { patch_id: patchId },
        select: { id: true }
      })
    ])

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

    // 内容已级联删除, 删除后再清理其未决审核任务与未处理申诉 (content_id 无外键, 用删除前收集的 id);
    // 清理置于删除后, 与 submitAppeal 的内容行锁配合, 杜绝并发申诉提交造成的 TOCTOU 孤儿
    await deletePendingModerationTasks(
      'comment',
      comments.map((comment) => comment.id),
      prisma
    )
    await deletePendingModerationTasks(
      'rating',
      ratings.map((rating) => rating.id),
      prisma
    )
    await deletePendingModerationTasks(
      'resource',
      patchResources.map((resource) => resource.id),
      prisma
    )
    await deletePendingAppeals(
      'comment',
      comments.map((comment) => comment.id),
      prisma
    )
    await deletePendingAppeals(
      'rating',
      ratings.map((rating) => rating.id),
      prisma
    )
    await deletePendingAppeals(
      'resource',
      patchResources.map((resource) => resource.id),
      prisma
    )

    return {}
  })

  queueSearchRemove(patchId)

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
