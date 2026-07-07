import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { patchResourceUpdateSchema } from '~/validations/patch'
import { markdownToHtml } from '~/app/api/utils/render/markdownToHtml'
import {
  bindUploadedResource,
  deletePatchResourceLink,
  recalcPatchType
} from './_helper'
import { invalidateResourceListCache } from '~/app/api/resource/cache'
import { queueSearchSync } from '~/server/search/sync'
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
  const { resourceId, patchId, links, ...resourceData } = input
  const resource = await prisma.patch_resource.findUnique({
    where: { id: resourceId },
    include: {
      links: {
        orderBy: { sort_order: 'asc' }
      }
    }
  })
  // 隐藏 (status=3) 的资源仅后台可管理, 前端与不存在等同
  if (!resource || resource.status === 3) {
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
    // status=1 (屏蔽): 管理员 shadow ban 不产生审核任务, 放行编辑会重新送审,
    // AI 通过后 status 1→0 静默解除管理员的封禁
    if (resource.status === 1) {
      return '您发布的资源正在审核中, 暂时无法修改'
    }
  }

  const currentPatch = await prisma.patch.findUnique({
    where: { id: patchId },
    select: { name: true }
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

  // 编辑标题/介绍后必须重新送审; 待人工审批 (status=2) 的资源不送 AI;
  // role>=3 管理员内联编辑他人内容与后台一致不送审, 避免审核任务误挂到原作者
  const textChanged =
    resource.name !== input.name || resource.note !== input.note
  const moderation =
    userRole >= 3 || resource.status === 2 || !textChanged
      ? MODERATION_SKIP
      : await preScreenText(`标题: ${input.name}\n介绍: ${input.note}`)

  const updatedResource = await prisma.$transaction(async (prisma) => {
    const newResource = await prisma.patch_resource.update({
      where: { id: resourceId },
      data: {
        ...resourceData,
        ...(moderation.intercept ? { status: 1 } : {}),
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

    if (moderation.queue) {
      await createModerationTask(
        {
          contentType: 'resource',
          contentId: resourceId,
          userId: resource.user_id,
          payload: {
            text: `标题: ${newResource.name}\n介绍: ${newResource.note}`,
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

  const wasListed = resource.status === 0 && resource.section === 'patch'
  const isListed =
    updatedResource.status === 0 && updatedResource.section === 'patch'
  if (wasListed || isListed) {
    await invalidateResourceListCache()
  }

  for (const link of s3LinksToDelete) {
    await deletePatchResourceLink(
      link.content,
      link.patchId,
      link.hash,
      link.s3Key
    )
  }

  // status=1 对非管理员掩码为 0, 防作者从响应探测屏蔽状态;
  // 掩码放在最后, 上方的缓存失效判断使用真实状态
  return {
    ...updatedResource,
    status:
      updatedResource.status === 1 && userRole < 3 ? 0 : updatedResource.status
  }
}
