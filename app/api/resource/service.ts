import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { resourceSchema } from '~/validations/resource'
import {
  getCachedResourceList,
  getResourceListCacheKey,
  setResourceListCache
} from './cache'
import type { Prisma } from '~/prisma/generated/prisma/client'
import type { PatchResource, ResourceListResponse } from '~/types/api/resource'

export const getPatchResource = async (
  input: z.infer<typeof resourceSchema>,
  visibilityWhere: Prisma.patchWhereInput
): Promise<ResourceListResponse> => {
  const { sortField, sortOrder, page, limit } = input
  const cacheKey = await getResourceListCacheKey(input, visibilityWhere)

  const cached = await getCachedResourceList(cacheKey)
  if (cached.response) {
    return cached.response
  }

  const offset = (page - 1) * limit

  const orderByField: Prisma.patch_resourceOrderByWithRelationInput =
    sortField === 'like'
      ? { like_by: { _count: sortOrder } }
      : { [sortField]: sortOrder }

  const [resourcesData, total] = await Promise.all([
    prisma.patch_resource.findMany({
      take: limit,
      skip: offset,
      orderBy: orderByField,
      where: { patch: visibilityWhere, section: 'patch', status: 0 },
      select: {
        id: true,
        name: true,
        section: true,
        type: true,
        language: true,
        platform: true,
        download: true,
        patch_id: true,
        created: true,
        patch: {
          select: {
            name: true,
            unique_id: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
            _count: {
              select: { patch_resource: true }
            }
          }
        },
        links: {
          orderBy: { sort_order: 'asc' },
          take: 1,
          select: {
            size: true
          }
        },
        _count: {
          select: {
            like_by: true,
            links: true
          }
        }
      }
    }),
    prisma.patch_resource.count({
      where: { patch: visibilityWhere, section: 'patch', status: 0 }
    })
  ])

  const resources: PatchResource[] = resourcesData.map((resource) => ({
    id: resource.id,
    name: resource.name,
    section: resource.section,
    uniqueId: resource.patch.unique_id,
    type: resource.type,
    language: resource.language,
    platform: resource.platform,
    primaryLink: resource.links[0] ? { size: resource.links[0].size } : null,
    linkCount: resource._count.links,
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

  const response = { resources, total }
  if (cached.canWrite && cacheKey) {
    await setResourceListCache(cacheKey, response)
  }

  return response
}
