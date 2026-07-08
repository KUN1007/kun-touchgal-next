import { randomBytes } from 'crypto'
import { copyObject, deleteFileFromS3, headObject } from '~/lib/s3'
import { acquireKvLock, delKv, getKv, releaseKvLock } from '~/lib/redis'
import { prisma } from '~/prisma/index'
import type { Prisma } from '~/prisma/generated/prisma/client'
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

// 通告锁命名空间 (pg_advisory_xact_lock 首参): 同一 patch 的并发重算按 (域, patchId)
// 串行, 与评分统计锁 (rating stat) 分属不同域, 互不阻塞
const PATCH_TYPE_LOCK_NAMESPACE = 481001

const recalcPatchTypeLocked = async (
  patchId: number,
  tx: Prisma.TransactionClient
) => {
  // pg_advisory_xact_lock: 事务级通告锁, 提交/回滚时自动释放. 使同一 patch 的
  // 「读全部可见资源 → 写 type/language/platform」原子化, 消除重叠事务 (审核重叠批次、
  // 管理员与用户并发操作) 的丢更新. 用 $executeRaw (而非 $queryRaw): pg adapter 无法
  // 反序列化 void 返回列; ::int 显式定型以匹配 (int, int) 重载
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PATCH_TYPE_LOCK_NAMESPACE}::int, ${patchId}::int)`

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

// 现有调用方全部在事务内 (审核 apply / 申诉 / 资源增删改 / 管理端), 传入其 tx: 锁随该
// 事务提交释放, 且重算参与调用方事务、能见其未提交的资源改动. 不传 tx 时自开事务兜底.
// 两个易错点: (1) 交互事务客户端运行期仍带 $transaction 属性, 故不能用 'in' 判据区分,
// 只能判 tx 是否传入. (2) tx 必须是交互事务客户端; 顶层 prisma 虽能过类型检查 (结构
// 超集), 但会让通告锁跑在 autocommit 连接上、语句结束即释放 → 序列化静默失效, 切勿传入
export const recalcPatchType = async (
  patchId: number,
  tx?: Prisma.TransactionClient
) => {
  if (!tx) {
    return prisma.$transaction((t) => recalcPatchTypeLocked(patchId, t))
  }
  return recalcPatchTypeLocked(patchId, tx)
}
