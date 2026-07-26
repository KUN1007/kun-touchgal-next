import { prisma } from '~/prisma/index'
import {
  getResourceVisibilityWhere,
  type KunViewer
} from '~/app/api/utils/contentVisibility'
import {
  GalgameCardSelectField,
  toGalgameCardCount
} from '~/constants/api/select'
import { mapResource, resourceInclude } from './get'
import type { PatchResource } from '~/types/api/patch'

export interface PatchResourceDetail {
  resource: PatchResource
  patchName: string
  contentLimit: string
  galgame: GalgameCard
}

// 资源详情页专用: 单行查询不走共享缓存 (note 的 markdown 渲染自带内容级缓存),
// 可见性与列表一致——status 2/3 仅作者与 role >= 3 可见, 1 前台不可见
export const getPatchResourceDetail = async (
  resourceId: number,
  viewer: KunViewer | null
): Promise<PatchResourceDetail | string> => {
  const uid = viewer?.uid ?? 0

  const data = await prisma.patch_resource.findFirst({
    where: { id: resourceId, ...getResourceVisibilityWhere(viewer) },
    include: {
      ...resourceInclude,
      patch: { select: { ...GalgameCardSelectField, content_limit: true } },
      like_by: { where: { user_id: uid } }
    }
  })
  if (!data) {
    return '未找到该资源'
  }

  const resource = await mapResource(data, data.like_by.length > 0)
  const gal = data.patch
  const galgame: GalgameCard = {
    id: gal.id,
    uniqueId: gal.unique_id,
    name: gal.name,
    banner: gal.banner,
    view: gal.view,
    download: gal.download,
    type: gal.type,
    language: gal.language,
    platform: gal.platform,
    tags: gal.tag.map((t) => t.tag.name).slice(0, 3),
    created: gal.created,
    _count: toGalgameCardCount(gal),
    averageRating: gal.rating_stat?.avg_overall
      ? Math.round(gal.rating_stat.avg_overall * 10) / 10
      : 0
  }

  return {
    resource,
    patchName: gal.name,
    contentLimit: gal.content_limit,
    galgame
  }
}
