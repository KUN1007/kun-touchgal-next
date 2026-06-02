import { randomBytes } from 'crypto'
import { copyObject, deleteFileFromS3, headObject } from '~/lib/s3'
import { acquireKvLock, delKv, getKv, releaseKvLock } from '~/lib/redis'
import { prisma } from '~/prisma/index'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'
import { invalidateUserSession } from '~/app/api/user/session/cache'
import {
  OBJECT_STORAGE_MAX_FILE_SIZE_BYTES,
  OBJECT_STORAGE_MAX_FILE_SIZE_ERROR,
  RESOURCE_DAILY_UPLOAD_LIMIT_MB
} from '~/constants/resource'

interface UploadTokenMeta {
  s3Key: string
  fileName: string
  declared: number
  uid: number
}

const BIND_LOCK_TTL_SECONDS = 60

const cleanupRejectedUpload = async (token: string, s3Key: string) => {
  await deleteFileFromS3(s3Key).catch(() => undefined)
  await delKv(`upload:${token}`).catch(() => undefined)
}

export const bindUploadedResource = async (
  patchId: number,
  token: string,
  uid: number
) => {
  const lockKey = `upload-bind:${token}`
  const lockToken = await acquireKvLock(lockKey, BIND_LOCK_TTL_SECONDS)
  if (!lockToken) {
    return '该上传 token 正在被处理, 请稍后再试'
  }

  try {
    const raw = await getKv(`upload:${token}`)
    if (!raw) {
      return '上传 token 已过期或不存在, 请重新上传文件'
    }
    const meta = JSON.parse(raw) as UploadTokenMeta
    if (meta.uid !== uid) {
      return '上传 token 不属于当前用户'
    }

    const info = await headObject(meta.s3Key).catch(() => null)
    if (!info) {
      return '文件未上传成功, 请重新上传'
    }
    const actualSize = Number(info.ContentLength ?? 0)
    if (actualSize !== meta.declared) {
      await cleanupRejectedUpload(token, meta.s3Key)
      return '文件大小不一致, 请重新上传'
    }
    if (actualSize >= OBJECT_STORAGE_MAX_FILE_SIZE_BYTES) {
      await cleanupRejectedUpload(token, meta.s3Key)
      return OBJECT_STORAGE_MAX_FILE_SIZE_ERROR
    }
    const fileSizeMB = Number((actualSize / (1024 * 1024)).toFixed(3))
    const quota = await prisma.user.updateMany({
      where: {
        id: uid,
        daily_upload_size: {
          lte: RESOURCE_DAILY_UPLOAD_LIMIT_MB - fileSizeMB
        }
      },
      data: { daily_upload_size: { increment: fileSizeMB } }
    })
    if (quota.count === 0) {
      await cleanupRejectedUpload(token, meta.s3Key)
      return '您今日的上传大小已达到 5GB 限额'
    }

    const segment = randomBytes(32).toString('hex')
    const finalKey = `patch/${patchId}/resource/${segment}/${meta.fileName}`
    try {
      await copyObject(meta.s3Key, finalKey)
      await deleteFileFromS3(meta.s3Key).catch(() => undefined)
      await delKv(`upload:${token}`)
    } catch (error) {
      await prisma.user
        .updateMany({
          where: {
            id: uid,
            daily_upload_size: { gte: fileSizeMB }
          },
          data: { daily_upload_size: { decrement: fileSizeMB } }
        })
        .catch(() => undefined)
      throw error
    }
    await invalidateUserSession(uid)

    const downloadLink = `${process.env.NEXT_PUBLIC_KUN_VISUAL_NOVEL_S3_STORAGE_URL!}/${finalKey}`
    return { downloadLink, s3Key: finalKey, size: actualSize }
  } finally {
    await releaseKvLock(lockKey, lockToken).catch(() => undefined)
  }
}

export const deletePatchResourceLink = async (
  content: string,
  patchId: number,
  hash: string,
  s3Key?: string
) => {
  if (s3Key) {
    await deleteFileFromS3(s3Key)
    return
  }

  const fileName = content.split('/').pop()
  if (!fileName) {
    return
  }
  const legacyKey = `patch/${patchId}/resource/${hash}/${fileName}`
  await deleteFileFromS3(legacyKey)
}

export const sanitizeResourceLinksForAuditLog = <
  L extends {
    content?: string
    password?: string
    code?: string
    hash?: string
    s3_key?: string
  }
>(
  links: L[] | undefined | null
): Omit<L, 'content' | 'password' | 'code' | 'hash' | 's3_key'>[] => {
  if (!links) {
    return []
  }
  return links.map(({ content, password, code, hash, s3_key, ...rest }) => rest)
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
