import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { Prisma } from '~/prisma/generated/prisma/client'
import { encodePatchBanner, putPatchBannerToS3 } from './_upload'
import { patchCreateSchema } from '~/validations/edit'
import { kunMoyuMoe } from '~/config/moyu-moe'
import { postToIndexNow } from './_postToIndexNow'
import { processSubmittedExternalData } from './processExternalData'
import { invalidateUserSession } from '~/app/api/user/session/cache'
import { queueSearchSync, enqueueSearchOutbox } from '~/server/search/sync'

type CreateGalgameInput = Omit<
  z.infer<typeof patchCreateSchema>,
  'alias' | 'tag' | 'banner' | 'bannerOriginal'
> & {
  alias: string[]
  tag: string[]
  banner: ArrayBuffer
  bannerOriginal?: ArrayBuffer
}

export const createGalgame = async (input: CreateGalgameInput, uid: number) => {
  const {
    name,
    vndbId,
    vndbRelationId,
    bangumiId,
    steamId,
    dlsiteCode,
    dlsiteCircleName,
    dlsiteCircleLink,
    vndbTags,
    vndbDevelopers,
    bangumiTags,
    bangumiDevelopers,
    steamTags,
    steamDevelopers,
    steamAliases,
    alias,
    banner,
    bannerOriginal,
    tag,
    introduction,
    released,
    contentLimit
  } = input

  const galgameUniqueId = crypto.randomBytes(4).toString('hex')

  const normalizedVndbId = vndbId?.trim() ? vndbId.trim().toLowerCase() : ''
  const normalizedVndbRelationId = vndbRelationId?.trim()
    ? vndbRelationId.trim().toLowerCase()
    : ''
  const normalizedDlsiteCode = dlsiteCode?.trim()
    ? dlsiteCode.trim().toUpperCase()
    : ''
  const normalizedBangumiId = bangumiId ? Number(bangumiId) : null
  const normalizedSteamId = steamId ? Number(steamId) : null
  const [vndbPatch, dlsitePatch, bangumiPatch, steamPatch] = await Promise.all([
    normalizedVndbId && normalizedVndbRelationId
      ? prisma.patch.findFirst({
          where: {
            vndb_id: normalizedVndbId,
            vndb_relation_id: normalizedVndbRelationId
          },
          select: { unique_id: true }
        })
      : null,
    normalizedDlsiteCode
      ? prisma.patch.findFirst({
          where: { dlsite_code: normalizedDlsiteCode },
          select: { unique_id: true }
        })
      : null,
    normalizedBangumiId !== null
      ? prisma.patch.findFirst({
          where: { bangumi_id: normalizedBangumiId },
          select: { unique_id: true }
        })
      : null,
    normalizedSteamId !== null
      ? prisma.patch.findFirst({
          where: { steam_id: normalizedSteamId },
          select: { unique_id: true }
        })
      : null
  ])

  if (vndbPatch) {
    return `Galgame VNDB ID 与 Relation ID 的组合与游戏 ID 为 ${vndbPatch.unique_id} 的游戏重复`
  }
  if (dlsitePatch) {
    return `Galgame DLSite Code 与游戏 ID 为 ${dlsitePatch.unique_id} 的游戏重复`
  }
  if (bangumiPatch) {
    return `Galgame Bangumi ID 与游戏 ID 为 ${bangumiPatch.unique_id} 的游戏重复`
  }
  if (steamPatch) {
    return `Galgame Steam ID 与游戏 ID 为 ${steamPatch.unique_id} 的游戏重复`
  }

  // 编码与校验必须在事务外完成: 它返回字符串表示业务错误, 若在事务回调内 return,
  // Prisma 会把回调正常结束当作提交, 留下一条 banner 为空、无别名/标签/搜索文档的
  // 孤儿 patch 行 (status 默认 0, 会直接出现在公开列表里)
  const encodedBanner = await encodePatchBanner(banner, bannerOriginal)
  if (typeof encodedBanner === 'string') {
    return encodedBanner
  }

  const res = await prisma
    .$transaction(
      async (prisma) => {
        const patch = await prisma.patch.create({
          data: {
            name,
            unique_id: galgameUniqueId,
            vndb_id: normalizedVndbId ? normalizedVndbId : null,
            vndb_relation_id: normalizedVndbRelationId
              ? normalizedVndbRelationId
              : null,
            bangumi_id: normalizedBangumiId,
            steam_id: normalizedSteamId,
            dlsite_code: normalizedDlsiteCode ? normalizedDlsiteCode : null,
            introduction,
            user_id: uid,
            banner: '',
            released,
            content_limit: contentLimit
          }
        })

        const newId = patch.id

        await putPatchBannerToS3(encodedBanner, newId)

        const imageLink = `${process.env.KUN_VISUAL_NOVEL_IMAGE_BED_URL}/patch/${newId}/banner/banner.avif`

        await prisma.patch.update({
          where: { id: newId },
          data: { banner: imageLink }
        })

        // Ensure rating_stat row exists for this patch
        await prisma.patch_rating_stat.create({
          data: { patch_id: newId }
        })

        if (alias.length) {
          const aliasData = alias.map((name) => ({
            name,
            patch_id: newId
          }))
          await prisma.patch_alias.createMany({
            data: aliasData,
            skipDuplicates: true
          })
        }

        await prisma.user.update({
          where: { id: uid },
          data: {
            daily_image_count: { increment: 1 },
            moemoepoint: { increment: 3 }
          }
        })

        // 事务性入队：与 patch.create 原子提交，关闭崩溃丢失窗口；tags 由后续
        // processSubmittedExternalData 独立事务写入，drain 读最新状态仍会纳入
        await enqueueSearchOutbox(prisma, newId)

        return { patchId: newId }
      },
      { timeout: 60000 }
    )
    .catch((error) => {
      // bangumi_id / steam_id / dlsite_code / (vndb_id, vndb_relation_id) 的唯一索引
      // 兜底并发创建: 预检与 patch.create 之间隔着 encodePatchBanner, 实测可达十几秒,
      // 两个填同一外部 ID 的请求会双双通过预检. 字符串在此处返回是安全的(事务已回滚),
      // 但切勿把它挪进事务回调 —— 那会被当作正常结束而提交
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return '您填写的外部 ID 已经被其它 Galgame 使用, 请检查后重试'
      }
      throw error
    })

  if (typeof res === 'string') {
    return res
  }

  await invalidateUserSession(uid)

  await processSubmittedExternalData(
    res.patchId,
    {
      vndbTags,
      vndbDevelopers,
      bangumiTags,
      bangumiDevelopers,
      steamTags,
      steamDevelopers,
      steamAliases,
      dlsiteCircleName: dlsiteCircleName ?? '',
      dlsiteCircleLink: dlsiteCircleLink ?? ''
    },
    tag,
    uid
  )

  queueSearchSync(res.patchId)

  if (contentLimit === 'sfw') {
    const newPatchUrl = `${kunMoyuMoe.domain.main}/${galgameUniqueId}`
    void postToIndexNow(newPatchUrl).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to post new patch to IndexNow', error)
    })
  }

  return { uniqueId: galgameUniqueId }
}
