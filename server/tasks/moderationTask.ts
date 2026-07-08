import cron from 'node-cron'
import sharp from 'sharp'
import { prisma } from '~/prisma'
import type { moderation_taskModel } from '~/prisma/generated/prisma/models'
import type { Prisma } from '~/prisma/generated/prisma/client'
import { getKv, setKv } from '~/lib/redis'
import { getFileFromS3 } from '~/lib/s3'
import { KUN_MODERATION_VERDICT_CACHE_KEY } from '~/config/redis'
import {
  MODERATION_BATCH_SIZE,
  MODERATION_CONCURRENCY,
  MODERATION_MAX_RETRY,
  MODERATION_VERDICT_CACHE_DURATION
} from '~/constants/moderation'
import type { ModerationContentType } from '~/constants/moderation'
import {
  ModerationConfigError,
  moderateImage,
  moderateText,
  moderationVerdictSchema
} from '~/server/moderation/ai'
import type {
  ModerationAiResult,
  ModerationVerdict
} from '~/server/moderation/ai'
import {
  applyModerationVerdict,
  markTaskManual
} from '~/server/moderation/apply'
import {
  hashModerationText,
  matchBlacklist,
  normalizeModerationText
} from '~/server/moderation/prefilter'
import type {
  ModerationAvatarPayload,
  ModerationTextPayload
} from '~/server/moderation/submit'
import { withTaskLock } from './withTaskLock'

const MODERATION_LOCK_KEY = 'moderation:worker:lock'
const MODERATION_LOCK_TTL_SECONDS = 300

// verdicts are cached per content_type: each type has a distinct system prompt,
// so a verdict from one type must never be replayed onto another
type ModerationTextType = Exclude<ModerationContentType, 'avatar'>

const verdictCacheKey = (contentType: ModerationTextType, hash: string) =>
  `${KUN_MODERATION_VERDICT_CACHE_KEY}:${contentType}:${hash}`

const getCachedVerdict = async (
  contentType: ModerationTextType,
  hash: string
): Promise<ModerationVerdict | null> => {
  const cached = await getKv(verdictCacheKey(contentType, hash))
  if (!cached) {
    return null
  }
  try {
    const verdict = moderationVerdictSchema.safeParse(JSON.parse(cached))
    return verdict.success ? verdict.data : null
  } catch {
    return null
  }
}

const cacheVerdict = async (
  contentType: ModerationTextType,
  hash: string,
  verdict: ModerationVerdict
) => {
  await setKv(
    verdictCacheKey(contentType, hash),
    JSON.stringify(verdict),
    MODERATION_VERDICT_CACHE_DURATION
  ).catch((error) =>
    console.error('Failed to cache moderation verdict:', error)
  )
}

const applyAiResult = async (
  task: moderation_taskModel,
  result: ModerationAiResult
) => {
  const { verdict } = result
  await applyModerationVerdict({
    task,
    approved: verdict.p === 1,
    manual: verdict.m === 1,
    rejectCode: verdict.c,
    rejectReason: verdict.r,
    verdict: verdict as Prisma.InputJsonValue,
    model: result.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut
  })
}

const processTextTask = async (
  task: moderation_taskModel,
  blacklistPatterns: string[]
) => {
  const payload = task.payload as unknown as ModerationTextPayload
  const normalized = normalizeModerationText(payload.text ?? '')

  const blacklistHit = matchBlacklist(normalized, blacklistPatterns)
  if (blacklistHit) {
    await applyModerationVerdict({
      task,
      approved: false,
      rejectCode: 'BLK',
      rejectReason: '命中黑名单',
      model: 'blacklist'
    })
    return
  }

  const contentType = task.content_type as ModerationTextType
  const hash = hashModerationText(normalized)
  const cached = await getCachedVerdict(contentType, hash)
  if (cached) {
    await applyAiResult(task, {
      verdict: cached,
      model: 'cache',
      tokensIn: 0,
      tokensOut: 0
    })
    return
  }

  const result = await moderateText(contentType, payload.text ?? '')
  await cacheVerdict(contentType, hash, result.verdict)
  await applyAiResult(task, result)
}

const processAvatarTask = async (task: moderation_taskModel) => {
  const payload = task.payload as unknown as ModerationAvatarPayload
  const buffer = await getFileFromS3(payload.pendingKey)
  // vision APIs handle jpeg far more reliably than avif
  const jpeg = await sharp(buffer).jpeg({ quality: 85 }).toBuffer()
  const result = await moderateImage(jpeg.toString('base64'))
  await applyAiResult(task, result)
}

// 处理单条任务: 成功即落裁决, 失败按重试/转人工记账. 各任务的 apply 是独立事务,
// 缓存与黑名单为共享只读, 因此可安全并发
const processTask = async (
  task: moderation_taskModel,
  blacklistPatterns: string[]
) => {
  try {
    if (task.content_type === 'avatar') {
      await processAvatarTask(task)
    } else {
      await processTextTask(task, blacklistPatterns)
    }
  } catch (error) {
    if (error instanceof ModerationConfigError) {
      await markTaskManual(task.id, error.message)
      return
    }

    const retry = task.retry + 1
    if (retry >= MODERATION_MAX_RETRY) {
      await markTaskManual(task.id, `审核失败: ${String(error)}`)
    } else {
      // exponential backoff: 5s, 25s
      await prisma.moderation_task.updateMany({
        where: { id: task.id, status: 'pending' },
        data: {
          retry,
          next_attempt: new Date(Date.now() + 5 ** retry * 1000)
        }
      })
    }
    console.error(`Moderation task ${task.id} attempt failed:`, error)
  }
}

// 同一 patch 的 resource/rating 裁决会读改写 patch 级聚合 (recalcPatchType 改
// patch.type、recomputePatchRatingStat 改 patch_rating_stat), 并发 apply 会丢更新;
// avatar/bio 会写同一 user 行. 用序列化 key 把会相互竞态的任务归到同组 (组内串行、
// 组间并发). patch_id 不在 task 行上, 按 content_id 分组会让同一 patch 的两条落入
// 不同组并发跑, 故 resource/rating 只能按类型整体串行 (代价: 这两类批内不提速);
// avatar/bio 按 user 分组; 评论各自独立, 全并发
const serializationKey = (task: moderation_taskModel): string => {
  switch (task.content_type) {
    case 'resource':
    case 'rating':
      return task.content_type
    case 'avatar':
    case 'bio':
      return `user:${task.user_id}`
    default:
      return `comment:${task.id}`
  }
}

// blacklist 只被这一个 cron 进程读、且极少变动, 进程内短 TTL 缓存即可, 免去每
// 15s tick 的全表重载 (与 getModerationConfig 同一权衡: 命中即拒的新规则最长延迟
// BLACKLIST_CACHE_DURATION_MS 生效)
const BLACKLIST_CACHE_DURATION_MS = 60 * 1000

let blacklistCache: { patterns: string[]; expire: number } | null = null

const getBlacklistPatterns = async (): Promise<string[]> => {
  const now = Date.now()
  if (blacklistCache && blacklistCache.expire > now) {
    return blacklistCache.patterns
  }
  const rows = await prisma.moderation_blacklist.findMany({
    select: { pattern: true }
  })
  const patterns = rows.map((item) => item.pattern)
  blacklistCache = { patterns, expire: now + BLACKLIST_CACHE_DURATION_MS }
  return patterns
}

const runModerationBatch = async () => {
  const tasks = await prisma.moderation_task.findMany({
    where: { status: 'pending', next_attempt: { lte: new Date() } },
    orderBy: { created: 'asc' },
    take: MODERATION_BATCH_SIZE
  })
  if (!tasks.length) {
    return
  }

  // blacklist 仅文本任务需要: 纯头像批跳过查询, 其余走进程内缓存
  const needsBlacklist = tasks.some((task) => task.content_type !== 'avatar')
  const blacklistPatterns = needsBlacklist ? await getBlacklistPatterns() : []

  // 把会相互竞态的任务归到同组 (组内串行), 再以有界并发处理各组: 一次慢的 vision
  // 调用不再阻塞排在其后的缓存/文本裁决. 批次只取一次, 并发 worker 通过 cursor++
  // 各领一组, 永不重复处理同一行
  const groups = new Map<string, moderation_taskModel[]>()
  for (const task of tasks) {
    const key = serializationKey(task)
    const group = groups.get(key)
    if (group) {
      group.push(task)
    } else {
      groups.set(key, [task])
    }
  }
  const groupList = [...groups.values()]

  let cursor = 0
  const runWorker = async () => {
    let index: number
    while ((index = cursor++) < groupList.length) {
      for (const task of groupList[index]) {
        await processTask(task, blacklistPatterns)
      }
    }
  }
  // allSettled 而非 all: 即便某 worker 因记账写库失败而 reject, 也必须等其余 worker
  // 全部结束再返回——否则 withTaskLock 会在后台 worker 仍运行时释放锁, 与下批重叠
  const workerCount = Math.min(MODERATION_CONCURRENCY, groupList.length)
  const results = await Promise.allSettled(
    Array.from({ length: workerCount }, runWorker)
  )
  // worker 仅在记账写库失败时 reject (业务错误已在 processTask 内消化并记录);
  // 补记 rejected, 否则 DB 故障会让整批静默失败、排障无迹
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Moderation worker crashed:', result.reason)
    }
  }
}

export const moderationTask = cron.createTask('*/15 * * * * *', async () => {
  await withTaskLock(
    {
      key: MODERATION_LOCK_KEY,
      ttlSeconds: MODERATION_LOCK_TTL_SECONDS,
      taskName: 'moderationTask'
    },
    runModerationBatch
  ).catch((error) => {
    console.error('Error running moderation batch:', error)
  })
})
