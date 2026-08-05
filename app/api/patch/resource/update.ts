import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { patchResourceUpdateSchema } from '~/validations/patch'
import { markdownToHtml } from '~/app/api/utils/render/markdownToHtml'
import {
  bindUploadedResource,
  enqueueResourceLinkDeletions,
  recalcPatchType
} from './_helper'
import { invalidatePatchResourceDetailCache } from './cache'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'
import { invalidateUserPendingResourceCache } from '~/app/api/utils/pendingResourceCache'
import { enqueueSearchOutbox, queueSearchSync } from '~/server/search/sync'
import { kickS3DeletionDrain } from '~/server/storage/s3Outbox'
import {
  MODERATION_SKIP,
  createModerationTask,
  hasPendingModeration,
  preScreenText
} from '~/server/moderation/submit'
import type { PatchResource } from '~/types/api/patch'

export const updatePatchResource = async (
  input: z.infer<typeof patchResourceUpdateSchema>,
  uid: number,
  userRole: number
) => {
  const {
    resourceId,
    patchId: inputPatchId,
    links,
    emulatorType,
    modelName,
    ...resourceData
  } = input
  // 联动字段随所选平台/类型归一: 未含对应平台/类型时不落库残值
  const emulator_type = input.platform.includes('emulator') ? emulatorType : []
  const model_name = input.type.includes('ai') ? modelName : ''
  const resource = await prisma.patch_resource.findUnique({
    where: { id: resourceId },
    include: {
      links: {
        orderBy: { sort_order: 'asc' }
      }
    }
  })
  // 隐藏 (status=1) 的资源仅后台可管理, 前端与不存在等同
  if (!resource || resource.status === 1) {
    return '未找到该资源'
  }

  if (resource.user_id !== uid && userRole < 3) {
    return '您没有权限更改该资源'
  }
  if (userRole < 3) {
    // status=2: 首个资源的人工审批流, 审批期间同样禁止修改
    if (resource.status === 2) {
      return '您发布的资源正在等待管理员审核, 暂时无法修改'
    }
    if (await hasPendingModeration('resource', { contentId: resourceId })) {
      return '您发布的资源正在审核中, 暂时无法修改'
    }
    // 待审核 (status=3) 的资源禁止修改; hasPendingModeration 之外再兜底一层
    if (resource.status === 3) {
      return '您发布的资源正在审核中, 暂时无法修改'
    }
  }

  if (inputPatchId !== resource.patch_id) {
    return '资源与 Galgame 不匹配'
  }
  const patchId = resource.patch_id
  const currentPatch = await prisma.patch.findUnique({
    where: { id: patchId },
    select: { id: true }
  })
  if (!currentPatch) {
    return '未找到该资源对应的 Galgame 信息, 请确认 Galgame 存在'
  }

  const existingLinksById = new Map(
    resource.links.map((link) => [link.id, link])
  )
  const nextLinkIds = new Set(
    links
      .map((link) => link.id)
      .filter((id): id is number => typeof id === 'number')
  )
  const linksToDelete = resource.links.filter(
    (link) => !nextLinkIds.has(link.id)
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
  const s3LinksToDelete: Array<{
    content: string
    patchId: number
    hash: string
    s3Key: string
  }> = []

  for (const removedLink of linksToDelete) {
    if (removedLink.storage === 's3') {
      s3LinksToDelete.push({
        content: removedLink.content,
        patchId: resource.patch_id,
        hash: removedLink.hash,
        s3Key: removedLink.s3_key
      })
    }
  }

  for (const [index, link] of links.entries()) {
    const existingLink =
      typeof link.id === 'number' ? existingLinksById.get(link.id) : null

    let content = link.content
    let s3Key = ''
    let rebound = false

    if (link.storage === 's3') {
      if (link.hash) {
        const result = await bindUploadedResource(patchId, link.hash, uid)
        if (typeof result === 'string') {
          return result
        }
        content = result.downloadLink
        s3Key = result.s3Key
        rebound = true
      } else if (existingLink && existingLink.storage === 's3') {
        content = existingLink.content
        s3Key = existingLink.s3_key
      } else {
        return '请先上传资源文件'
      }
    }

    if (
      existingLink &&
      existingLink.storage === 's3' &&
      (link.storage !== 's3' || rebound)
    ) {
      s3LinksToDelete.push({
        content: existingLink.content,
        patchId: resource.patch_id,
        hash: existingLink.hash,
        s3Key: existingLink.s3_key
      })
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
      download: existingLink?.download ?? 0
    })
  }

  // 编辑标题/介绍/模型型号后必须重新送审; 待人工审批 (status=2) 的资源不送 AI;
  // 标题与介绍均为空的资源无文本可审, 直接放行
  const textChanged =
    resource.name !== input.name ||
    resource.note !== input.note ||
    resource.model_name !== model_name
  const moderationText = `标题: ${input.name}\n介绍: ${input.note}${model_name ? `\n模型型号: ${model_name}` : ''}`
  const moderation =
    resource.status === 2 ||
    !textChanged ||
    !`${input.name}${input.note}${model_name}`.trim()
      ? MODERATION_SKIP
      : await preScreenText(moderationText, userRole)

  const updatedResource = await prisma.$transaction(async (prisma) => {
    const newResource = await prisma.patch_resource.update({
      where: { id: resourceId },
      data: {
        ...resourceData,
        emulator_type,
        model_name,
        ...(moderation.intercept ? { status: 3 } : {}),
        links: {
          deleteMany: {},
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
        patch: {
          select: {
            unique_id: true
          }
        },
        links: {
          orderBy: { sort_order: 'asc' }
        }
      }
    })

    await prisma.patch.update({
      where: { id: patchId },
      data: { resource_update_time: new Date() }
    })
    await recalcPatchType(patchId, prisma)
    // 事务性入队：与补丁变更原子提交，关闭崩溃丢失窗口
    await enqueueSearchOutbox(prisma, patchId)
    // 事务性入队 S3 删除 (被移除/重绑的旧链接)：与行变更原子提交，取代提交后
    // Promise.all 的不可恢复删除
    await enqueueResourceLinkDeletions(prisma, s3LinksToDelete)

    if (moderation.queue) {
      await createModerationTask(
        {
          contentType: 'resource',
          contentId: resourceId,
          // 分组用资源真实 patch_id (与 apply 的 recalcPatchType 对齐, 防 input 篡改失准)
          patchId: resource.patch_id,
          userId: resource.user_id,
          payload: {
            text: moderationText,
            name: newResource.name
          },
          dryRun: moderation.dryRun
        },
        prisma
      )
    }

    const resourceResponse: PatchResource = {
      id: newResource.id,
      name: newResource.name,
      section: newResource.section,
      uniqueId: newResource.patch.unique_id,
      type: newResource.type,
      language: newResource.language,
      note: newResource.note,
      noteHtml: newResource.note ? await markdownToHtml(newResource.note) : '',
      platform: newResource.platform,
      emulatorType: newResource.emulator_type,
      modelName: newResource.model_name,
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

    return resourceResponse
  })

  queueSearchSync(patchId)
  // 事务提交后失效: 事务内失效会被并发读回填旧值 (M-04), 且 Redis 故障不应回滚写入
  await invalidatePatchContentCache(updatedResource.uniqueId).catch(
    () => undefined
  )

  const wasPublic = resource.status === 0
  const isPublic = updatedResource.status === 0
  if (wasPublic || isPublic) {
    await invalidatePatchResourceDetailCache()
  }

  const wasListed = wasPublic && resource.section === 'patch'
  const isListed = isPublic && updatedResource.section === 'patch'
  if (wasListed || isListed) {
    await invalidateResourceListCache()
  }

  // 编辑触发审核拦截 (0→3): 作者的 hasPendingResource 由 false 翻真, 立即失效
  if (resource.status !== 3 && updatedResource.status === 3) {
    await invalidateUserPendingResourceCache(resource.user_id)
  }

  // 即时消费删除出箱；抢不到锁则由定时任务兜底
  kickS3DeletionDrain()

  return updatedResource
}
