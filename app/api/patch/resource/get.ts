import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { markdownToHtml } from '~/app/api/utils/render/markdownToHtml'
import {
  getResourceVisibilityWhere,
  type KunViewer
} from '~/app/api/utils/contentVisibility'
import type { PatchResource } from '~/types/api/patch'

const patchIdSchema = z.object({
  patchId: z.coerce.number().min(1).max(9999999)
})

export const getPatchResource = async (
  input: z.infer<typeof patchIdSchema>,
  viewer: KunViewer | null
) => {
  const { patchId } = input
  const uid = viewer?.uid ?? 0

  const data = await prisma.patch_resource.findMany({
    where: {
      patch_id: patchId,
      ...getResourceVisibilityWhere(viewer)
    },
    include: {
      patch: { select: { unique_id: true } },
      user: {
        include: {
          _count: {
            select: { patch_resource: true }
          }
        }
      },
      links: {
        orderBy: { sort_order: 'asc' }
      },
      _count: {
        select: { like_by: true }
      },
      like_by: {
        where: {
          user_id: uid
        }
      }
    }
  })

  const resources: PatchResource[] = await Promise.all(
    data.map(async (resource) => ({
      id: resource.id,
      name: resource.name,
      section: resource.section,
      uniqueId: resource.patch.unique_id,
      type: resource.type,
      language: resource.language,
      note: resource.note,
      noteHtml: resource.note ? await markdownToHtml(resource.note) : '',
      platform: resource.platform,
      links: resource.links.map((link) => ({
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
      likeCount: resource._count.like_by,
      isLike: resource.like_by.length > 0,
      status: resource.status,
      userId: resource.user_id,
      patchId: resource.patch_id,
      created: String(resource.created),
      user: {
        id: resource.user.id,
        name: resource.user.name,
        avatar: resource.user.avatar,
        patchCount: resource.user._count.patch_resource,
        role: resource.user.role
      }
    }))
  )

  return resources
}
