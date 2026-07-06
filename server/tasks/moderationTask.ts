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
  MODERATION_MAX_RETRY,
  MODERATION_VERDICT_CACHE_DURATION
} from '~/constants/moderation'
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

const getCachedVerdict = async (
  hash: string
): Promise<ModerationVerdict | null> => {
  const cached = await getKv(`${KUN_MODERATION_VERDICT_CACHE_KEY}:${hash}`)
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

const cacheVerdict = async (hash: string, verdict: ModerationVerdict) => {
  await setKv(
    `${KUN_MODERATION_VERDICT_CACHE_KEY}:${hash}`,
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

  const hash = hashModerationText(normalized)
  const cached = await getCachedVerdict(hash)
  if (cached) {
    await applyAiResult(task, {
      verdict: cached,
      model: 'cache',
      tokensIn: 0,
      tokensOut: 0
    })
    return
  }

  const result = await moderateText(
    task.content_type as 'comment' | 'rating' | 'resource' | 'bio',
    payload.text ?? ''
  )
  await cacheVerdict(hash, result.verdict)
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

const runModerationBatch = async () => {
  const tasks = await prisma.moderation_task.findMany({
    where: { status: 'pending', next_attempt: { lte: new Date() } },
    orderBy: { created: 'asc' },
    take: MODERATION_BATCH_SIZE
  })
  if (!tasks.length) {
    return
  }

  const blacklist = await prisma.moderation_blacklist.findMany({
    select: { pattern: true }
  })
  const blacklistPatterns = blacklist.map((item) => item.pattern)

  for (const task of tasks) {
    try {
      if (task.content_type === 'avatar') {
        await processAvatarTask(task)
      } else {
        await processTextTask(task, blacklistPatterns)
      }
    } catch (error) {
      if (error instanceof ModerationConfigError) {
        await markTaskManual(task.id, error.message)
        continue
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
