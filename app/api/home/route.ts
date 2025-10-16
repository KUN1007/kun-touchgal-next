import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '~/prisma/index'
import { HomeResource } from '~/types/api/home'
import { GalgameCardSelectField } from '~/constants/api/select'
import { getNSFWHeader } from '~/app/api/utils/getNSFWHeader'

export const getHomeData = async (
  nsfwEnable: Record<string, string | undefined>
) => {
  const [data, resourcesData] = await Promise.all([
    prisma.patch.findMany({
      orderBy: { created: 'desc' },
      where: nsfwEnable,
      select: GalgameCardSelectField,
      take: 20
    }),
    prisma.patch_resource.findMany({
      orderBy: { created: 'desc' },
      where: { patch: nsfwEnable, section: 'patch' },
      include: {
        patch: {
          select: {
            name: true,
            unique_id: true
          }
        },
        user: {
          include: {
            _count: {
              select: { patch_resource: true }
            }
          }
        },
        _count: {
          select: {
            like_by: true
          }
        }
      },
      take: 6
    })
  ])

  const galgames: GalgameCard[] = data.map((gal) => ({
    ...gal,
    tags: gal.tag.map((t) => t.tag.name).slice(0, 3),
    uniqueId: gal.unique_id,
    averageRating: gal.rating_stat?.avg_overall
      ? Math.round(gal.rating_stat.avg_overall * 10) / 10
      : 0
  }))

  const resources: HomeResource[] = resourcesData.map((resource) => ({
    id: resource.id,
    name: resource.name,
    section: resource.section,
    uniqueId: resource.patch.unique_id,
    storage: resource.storage,
    size: resource.size,
    type: resource.type,
    language: resource.language,
    note: resource.note.slice(0, 233),
    platform: resource.platform,
    likeCount: resource._count.like_by,
    download: resource.download,
    patchId: resource.patch_id,
    patchName: resource.patch.name,
    created: String(resource.created),
    user: {
      id: resource.user.id,
      name: resource.user.name,
      avatar: resource.user.avatar,
      patchCount: resource.user._count.patch_resource,
      role: resource.user.role
    }
  }))

  return { galgames, resources }
}

export const GET = async (req: NextRequest) => {
  const nsfwEnable = getNSFWHeader(req)

  const response = await getHomeData(nsfwEnable)
  return NextResponse.json(response)
}
