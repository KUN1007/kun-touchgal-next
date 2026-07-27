import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { patchResourceCreateSchema } from '~/validations/patch'
import { createMessage } from '~/app/api/utils/message'
import { markdownToHtml } from '~/app/api/utils/render/markdownToHtml'
import { bindUploadedResource, recalcPatchType } from './_helper'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'
import { invalidateUserSession } from '~/app/api/user/session/cache'
import { invalidateUserPendingResourceCache } from '~/app/api/utils/pendingResourceCache'
import { enqueueSearchOutbox, queueSearchSync } from '~/server/search/sync'
import {
  MODERATION_SKIP,
  createModerationTask,
  preScreenText
} from '~/server/moderation/submit'
import type { PatchResource } from '~/types/api/patch'

export const createPatchResource = async (
  input: z.infer<typeof patchResourceCreateSchema>,
  uid: number,
  userRole: number
) => {
  const {
    patchId: inputPatchId,
    type,
    language,
    platform,
    links,
    ...resourceData
  } = input

  const [currentPatch, resourceCount] = await Promise.all([
    prisma.patch.findUnique({
      where: { id: inputPatchId },
      select: {
        id: true,
        unique_id: true,
        name: true
      }
    }),
    prisma.patch_resource.count({
      where: { user_id: uid }
    })
  ])
  if (!currentPatch) {
    return '未找到该资源对应的 Galgame 信息, 请确认 Galgame 存在'
  }
  const patchId = currentPatch.id
  const needApproval = resourceCount === 0 && userRole < 3

  // 首个资源走既有人工审批流 (status=2), 不重复送 AI 审核;
  // 标题与介绍均为空的资源无文本可审, 直接放行
  const moderation =
    needApproval || !`${input.name}${input.note}`.trim()
      ? MODERATION_SKIP
      : await preScreenText(
          `标题: ${input.name}\n介绍: ${input.note}`,
          userRole
        )

  const preparedLinks: Array<{
    storage: string
    size: string
    code: string
    password: string
    hash: string
    s3_key: string
    content: string
    sort_order: number
    download: number
  }> = []
  for (const [index, link] of links.entries()) {
    let content = link.content
    let s3Key = ''
    if (link.storage === 's3') {
      if (!link.hash.trim()) {
        return '请先上传资源文件'
      }
      const result = await bindUploadedResource(patchId, link.hash, uid)
      if (typeof result === 'string') {
        return result
      }
      content = result.downloadLink
      s3Key = result.s3Key
    }

    preparedLinks.push({
      storage: link.storage,
      size: link.size,
      code: link.code,
      password: link.password,
      hash: link.storage === 's3' ? '' : link.hash,
      s3_key: s3Key,
      content,
      sort_order: index,
      download: 0
    })
  }

  const resource = await prisma.$transaction(async (prisma) => {
    const newResource = await prisma.patch_resource.create({
      data: {
        patch_id: patchId,
        user_id: uid,
        type,
        language,
        platform,
        status: needApproval ? 2 : moderation.intercept ? 3 : 0,
        ...resourceData,
        links: {
          create: preparedLinks
        }
      },
      include: {
        user: {
          include: {
            _count: {
              select: { patch_resource: true }
            }
          }
        },
        links: {
          orderBy: { sort_order: 'asc' }
        }
      }
    })

    await prisma.user.update({
      where: { id: uid },
      data: { moemoepoint: { increment: 3 } }
    })

    if (moderation.queue) {
      await createModerationTask(
        {
          contentType: 'resource',
          contentId: newResource.id,
          patchId,
          userId: uid,
          payload: {
            text: `标题: ${newResource.name}\n介绍: ${newResource.note}`,
            name: newResource.name
          },
          dryRun: moderation.dryRun
        },
        prisma
      )
    }

    await prisma.patch.update({
      where: { id: patchId },
      data: { resource_update_time: new Date() }
    })
    await recalcPatchType(patchId, prisma)
    // 事务性入队：与补丁变更原子提交，关闭崩溃丢失窗口
    await enqueueSearchOutbox(prisma, patchId)

    const resource: PatchResource = {
      id: newResource.id,
      name: newResource.name,
      section: newResource.section,
      uniqueId: currentPatch.unique_id,
      type: newResource.type,
      language: newResource.language,
      note: newResource.note,
      noteHtml: newResource.note ? await markdownToHtml(newResource.note) : '',
      platform: newResource.platform,
      download: newResource.download,
      links: newResource.links.map((link) => ({
        id: link.id,
        storage: link.storage,
        size: link.size,
        code: link.code,
        password: link.password,
        hash: link.hash,
        content: link.content,
        sortOrder: link.sort_order,
        download: link.download
      })),
      likeCount: 0,
      isLike: false,
      status: newResource.status,
      userId: newResource.user_id,
      patchId: newResource.patch_id,
      created: String(newResource.created),
      user: {
        id: newResource.user.id,
        name: newResource.user.name,
        avatar: newResource.user.avatar,
        patchCount: newResource.user._count.patch_resource,
        role: newResource.user.role
      }
    }

    return resource
  })

  queueSearchSync(patchId)
  // 事务提交后失效: 事务内失效会被并发读回填旧值 (M-04), 且 Redis 故障不应回滚写入
  await invalidatePatchContentCache(currentPatch.unique_id).catch(
    () => undefined
  )
  await invalidateUserSession(uid)

  if (resource.status === 0 && resource.section === 'patch') {
    await invalidateResourceListCache()
  }

  // 新资源进入待审核 (2/3): 作者的 hasPendingResource 由 false 翻真, 立即失效
  if (resource.status === 2 || resource.status === 3) {
    await invalidateUserPendingResourceCache(uid)
  }

  if (needApproval) {
    await createMessage({
      type: 'system',
      content: `您的首个资源「${currentPatch.name}」已提交审核，通过后将自动公开显示。`,
      recipient_id: uid,
      link: `/${currentPatch.unique_id}?tab=resources&resourceSection=${resource.section}&resourceId=${resource.id}`
    })
  }

  return resource
}
