import { deleteFileFromS3, uploadFileToS3 } from '~/lib/s3'
import { getKv } from '~/lib/redis'
import { prisma } from '~/prisma/index'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'

export const uploadPatchResource = async (patchId: number, hash: string) => {
  const filePath = await getKv(hash)
  if (!filePath) {
    return '本地临时文件存储未找到, 请重新上传文件'
  }
  const fileName = filePath.split('/').pop()
  const s3Key = `patch/${patchId}/resource/${hash}/${fileName}`
  await uploadFileToS3(s3Key, filePath)
  const downloadLink = `${process.env.NEXT_PUBLIC_KUN_VISUAL_NOVEL_S3_STORAGE_URL!}/${s3Key}`
  return { downloadLink }
}

export const deletePatchResourceLink = async (
  content: string,
  patchId: number,
  hash: string
) => {
  const fileName = content.split('/').pop()
  if (!fileName) {
    return
  }
  const s3Key = `patch/${patchId}/resource/${hash}/${fileName}`
  await deleteFileFromS3(s3Key)
}

export const sanitizeResourceLinksForAuditLog = <
  L extends {
    content?: string
    password?: string
    code?: string
    hash?: string
  }
>(
  links: L[] | undefined | null
): Omit<L, 'content' | 'password' | 'code' | 'hash'>[] => {
  if (!links) {
    return []
  }
  return links.map(({ content, password, code, hash, ...rest }) => rest)
}

export const recalcPatchType = async (
  patchId: number,
  tx: {
    patch_resource: Pick<typeof prisma.patch_resource, 'findMany'>
    patch: Pick<typeof prisma.patch, 'update'>
  } = prisma
) => {
  const resources = await tx.patch_resource.findMany({
    where: { patch_id: patchId, status: 0 },
    select: { type: true, language: true, platform: true }
  })

  const types = [...new Set(resources.flatMap((r) => r.type))]
  const languages = [...new Set(resources.flatMap((r) => r.language))]
  const platforms = [...new Set(resources.flatMap((r) => r.platform))]

  const patch = await tx.patch.update({
    where: { id: patchId },
    data: {
      type: { set: types },
      language: { set: languages },
      platform: { set: platforms }
    },
    select: { unique_id: true }
  })

  await invalidatePatchContentCache(patch.unique_id)
}
