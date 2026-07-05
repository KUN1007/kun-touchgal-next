import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { getUserInfoSchema } from '~/validations/user'
import {
  getResourceShadowBanWhere,
  type KunViewer
} from '~/app/api/utils/shadowBan'
import type { Prisma } from '~/prisma/generated/prisma/client'
import type { UserResource } from '~/types/api/user'

export const getUserPatchResource = async (
  input: z.infer<typeof getUserInfoSchema>,
  visibilityWhere: Prisma.patchWhereInput,
  viewer: KunViewer
) => {
  const { uid, page, limit } = input
  const offset = (page - 1) * limit
  const shadowBanWhere = getResourceShadowBanWhere(viewer)

  const [data, total] = await Promise.all([
    prisma.patch_resource.findMany({
      where: { user_id: uid, patch: visibilityWhere, ...shadowBanWhere },
      include: {
        patch: true
      },
      orderBy: { created: 'desc' },
      skip: offset,
      take: limit
    }),
    prisma.patch_resource.count({
      where: { user_id: uid, patch: visibilityWhere, ...shadowBanWhere }
    })
  ])

  const resources: UserResource[] = data.map((res) => ({
    id: res.id,
    section: res.section,
    patchUniqueId: res.patch.unique_id,
    patchId: res.patch.id,
    patchName: res.patch.name,
    patchBanner: res.patch.banner,
    type: res.type,
    language: res.language,
    platform: res.platform,
    created: String(res.created)
  }))

  return { resources, total }
}
