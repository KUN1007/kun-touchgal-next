import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { patchUpdateSchema } from '~/validations/edit'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'
import { processSubmittedExternalData } from './processExternalData'
import { queueSearchSync } from '~/server/search/sync'

export const updateGalgame = async (
  input: z.infer<typeof patchUpdateSchema>,
  uid: number
) => {
  const patch = await prisma.patch.findUnique({ where: { id: input.id } })
  if (!patch) {
    return '该 ID 下未找到对应 Galgame'
  }

  const normalizedVndbId = input.vndbId?.trim()
    ? input.vndbId.trim().toLowerCase()
    : ''
  const normalizedVndbRelationId = input.vndbRelationId?.trim()
    ? input.vndbRelationId.trim().toLowerCase()
    : ''
  if (normalizedVndbId && normalizedVndbRelationId) {
    const galgame = await prisma.patch.findFirst({
      where: {
        vndb_id: normalizedVndbId,
        vndb_relation_id: normalizedVndbRelationId
      }
    })
    if (galgame && galgame.id !== input.id) {
      return `Galgame VNDB ID 与 Relation ID 的组合与游戏 ID 为 ${galgame.unique_id} 的游戏重复`
    }
  }

  const normalizedDlsiteCode = input.dlsiteCode?.trim()
    ? input.dlsiteCode.trim().toUpperCase()
    : ''
  if (normalizedDlsiteCode) {
    const dlsitePatch = await prisma.patch.findFirst({
      where: { dlsite_code: normalizedDlsiteCode }
    })
    if (dlsitePatch && dlsitePatch.id !== input.id) {
      return `Galgame DLSite Code 与游戏 ID 为 ${dlsitePatch.unique_id} 的游戏重复`
    }
  }

  const {
    id,
    bangumiId,
    steamId,
    dlsiteCircleName,
    dlsiteCircleLink,
    vndbTags,
    vndbDevelopers,
    bangumiTags,
    bangumiDevelopers,
    steamTags,
    steamDevelopers,
    steamAliases,
    name,
    alias,
    introduction,
    contentLimit,
    released
  } = input

  await prisma.patch.update({
    where: { id },
    data: {
      name,
      vndb_id: normalizedVndbId ? normalizedVndbId : null,
      vndb_relation_id: normalizedVndbRelationId
        ? normalizedVndbRelationId
        : null,
      bangumi_id: bangumiId ? Number(bangumiId) : null,
      steam_id: steamId ? Number(steamId) : null,
      dlsite_code: normalizedDlsiteCode ? normalizedDlsiteCode : null,
      introduction,
      content_limit: contentLimit,
      released
    }
  })

  await prisma.$transaction(async (prisma) => {
    await prisma.patch_alias.deleteMany({
      where: { patch_id: id }
    })

    const aliasData = alias.map((name) => ({
      name,
      patch_id: id
    }))

    await prisma.patch_alias.createMany({
      data: aliasData,
      skipDuplicates: true
    })
  })

  await processSubmittedExternalData(
    id,
    {
      vndbTags: vndbTags ?? [],
      vndbDevelopers: vndbDevelopers ?? [],
      bangumiTags: bangumiTags ?? [],
      bangumiDevelopers: bangumiDevelopers ?? [],
      steamTags: steamTags ?? [],
      steamDevelopers: steamDevelopers ?? [],
      steamAliases: steamAliases ?? [],
      dlsiteCircleName: dlsiteCircleName ?? '',
      dlsiteCircleLink: dlsiteCircleLink ?? ''
    },
    input.tag,
    uid
  )

  queueSearchSync(id)

  try {
    await invalidatePatchContentCache(patch.unique_id)
  } catch {
    // 缓存失效失败不影响编辑结果
  }

  return {}
}
