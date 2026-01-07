import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { uploadPatchBanner } from './_upload'
import { patchCreateSchema } from '~/validations/edit'
import { handleBatchPatchTags } from './batchTag'
import { kunMoyuMoe } from '~/config/moyu-moe'
import { postToIndexNow } from './_postToIndexNow'
import { ensurePatchCompaniesFromVNDB } from './fetchCompanies'
import { ensurePatchCompanyFromDlsite } from './dlsite'

export const createGalgame = async (
  input: Omit<z.infer<typeof patchCreateSchema>, 'alias' | 'tag'> & {
    alias: string[]
    tag: string[]
  },
  uid: number
) => {
  const {
    name,
    vndbId,
    vndbRelationId,
    dlsiteCode,
    alias,
    banner,
    tag,
    introduction,
    released,
    contentLimit
  } = input

  const bannerArrayBuffer = banner as ArrayBuffer
  const galgameUniqueId = crypto.randomBytes(4).toString('hex')

  const normalizedDlsiteCode = dlsiteCode?.trim()
    ? dlsiteCode.trim().toUpperCase()
    : ''
  if (normalizedDlsiteCode) {
    const dlsitePatch = await prisma.patch.findFirst({
      where: { dlsite_code: normalizedDlsiteCode }
    })
    if (dlsitePatch) {
      return `Galgame DLSite Code 与游戏 ID 为 ${dlsitePatch.unique_id} 的游戏重复`
    }
  }

  const res = await prisma.$transaction(
    async (prisma) => {
      const patch = await prisma.patch.create({
        data: {
          name,
          unique_id: galgameUniqueId,
          vndb_id: vndbId ? vndbId : null,
          vndb_relation_id: vndbRelationId ? vndbRelationId : null,
          dlsite_code: normalizedDlsiteCode ? normalizedDlsiteCode : null,
          introduction,
          user_id: uid,
          banner: '',
          released,
          content_limit: contentLimit
        }
      })

      const newId = patch.id

      const uploadResult = await uploadPatchBanner(bannerArrayBuffer, newId)
      if (typeof uploadResult === 'string') {
        return uploadResult
      }
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

      return { patchId: newId }
    },
    { timeout: 60000 }
  )

  if (typeof res === 'string') {
    return res
  }

  if (vndbId) {
    try {
      await ensurePatchCompaniesFromVNDB(res.patchId, vndbId, uid)
    } catch (error) {}
  }

  if (normalizedDlsiteCode) {
    await ensurePatchCompanyFromDlsite(res.patchId, normalizedDlsiteCode, uid)
  }

  if (tag.length) {
    await handleBatchPatchTags(res.patchId, tag, uid)
  }

  if (contentLimit === 'sfw') {
    const newPatchUrl = `${kunMoyuMoe.domain.main}/${galgameUniqueId}`
    await postToIndexNow(newPatchUrl)
  }

  return { uniqueId: galgameUniqueId }
}
