import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { Prisma } from '~/prisma/generated/prisma/client'
import { patchUpdateSchema } from '~/validations/edit'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'
import { processSubmittedExternalData } from './processExternalData'
import { queueSearchSync, enqueueSearchOutbox } from '~/server/search/sync'

export const updateGalgame = async (
  input: z.infer<typeof patchUpdateSchema>,
  uid: number
) => {
  const patch = await prisma.patch.findUnique({
    where: { id: input.id },
    select: { unique_id: true }
  })
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
      },
      select: { id: true, unique_id: true }
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
      where: { dlsite_code: normalizedDlsiteCode },
      select: { id: true, unique_id: true }
    })
    if (dlsitePatch && dlsitePatch.id !== input.id) {
      return `Galgame DLSite Code 与游戏 ID 为 ${dlsitePatch.unique_id} 的游戏重复`
    }
  }

  const normalizedBangumiId = input.bangumiId ? Number(input.bangumiId) : null
  if (normalizedBangumiId !== null) {
    const bangumiPatch = await prisma.patch.findFirst({
      where: { bangumi_id: normalizedBangumiId },
      select: { id: true, unique_id: true }
    })
    if (bangumiPatch && bangumiPatch.id !== input.id) {
      return `Galgame Bangumi ID 与游戏 ID 为 ${bangumiPatch.unique_id} 的游戏重复`
    }
  }

  const normalizedSteamId = input.steamId ? Number(input.steamId) : null
  if (normalizedSteamId !== null) {
    const steamPatch = await prisma.patch.findFirst({
      where: { steam_id: normalizedSteamId },
      select: { id: true, unique_id: true }
    })
    if (steamPatch && steamPatch.id !== input.id) {
      return `Galgame Steam ID 与游戏 ID 为 ${steamPatch.unique_id} 的游戏重复`
    }
  }

  const {
    id,
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

  // 事务性入队：patch 字段更新与写出箱入队原子提交，关闭崩溃丢失窗口
  const updateResult = await prisma
    .$transaction(async (tx) => {
      await tx.patch.update({
        where: { id },
        data: {
          name,
          vndb_id: normalizedVndbId ? normalizedVndbId : null,
          vndb_relation_id: normalizedVndbRelationId
            ? normalizedVndbRelationId
            : null,
          bangumi_id: normalizedBangumiId,
          steam_id: normalizedSteamId,
          dlsite_code: normalizedDlsiteCode ? normalizedDlsiteCode : null,
          introduction,
          content_limit: contentLimit,
          released
        }
      })
      await enqueueSearchOutbox(tx, id)
    })
    .catch((error) => {
      // bangumi_id / steam_id / dlsite_code / (vndb_id, vndb_relation_id) 的唯一索引
      // 兜底并发编辑: 预检与 patch.update 之间两个填同一外部 ID 的请求会双双通过预检.
      // 字符串在此处返回是安全的(事务已回滚), 但切勿把它挪进事务回调 —— 那会被当作
      // 正常结束而提交
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return '您填写的外部 ID 已经被其它 Galgame 使用, 请检查后重试'
      }
      throw error
    })

  if (typeof updateResult === 'string') {
    return updateResult
  }

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
