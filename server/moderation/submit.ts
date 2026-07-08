import { prisma } from '~/prisma/index'
import type { Prisma } from '~/prisma/generated/prisma/client'
import type { ModerationContentType } from '~/constants/moderation'
import { getModerationConfig } from './config'
import { isWhitelistedText, prepareModerationText } from './prefilter'

type ModerationClient = Prisma.TransactionClient | typeof prisma

export interface ModerationPreScreen {
  // create a moderation task for the worker
  queue: boolean
  // content starts pending (待审核) until the verdict lands
  intercept: boolean
  dryRun: boolean
}

export const MODERATION_SKIP: ModerationPreScreen = {
  queue: false,
  intercept: false,
  dryRun: false
}

export const preScreenText = async (
  text: string
): Promise<ModerationPreScreen> => {
  const config = await getModerationConfig()
  if (!config.enabled) {
    return MODERATION_SKIP
  }
  if (!text.trim() || isWhitelistedText(text)) {
    return MODERATION_SKIP
  }
  return { queue: true, intercept: !config.dryRun, dryRun: config.dryRun }
}

export const preScreenMedia = async (): Promise<ModerationPreScreen> => {
  const config = await getModerationConfig()
  if (!config.enabled) {
    return MODERATION_SKIP
  }
  return { queue: true, intercept: !config.dryRun, dryRun: config.dryRun }
}

export interface ModerationTextPayload {
  // compacted snapshot sent to the AI
  text: string
  // resource name for the rejection notice
  name?: string
  // exact new bio value staged until approval
  bio?: string
}

export interface ModerationAvatarPayload {
  pendingKey: string
  pendingMiniKey: string
  avatarKey: string
  avatarMiniKey: string
  // versioned mini avatar URL written to user.avatar on approval
  avatarLink: string
  // staging URL shown to the author while the review is pending
  pendingLink: string
}

export type ModerationPayload = ModerationTextPayload | ModerationAvatarPayload

// 内容存在未裁决的审核任务 (AI 审核中或等待人工) 时禁止作者再次修改,
// 否则编辑会使送审快照与实际内容脱节, 也可绕过尚未落地的人工裁决;
// dry_run 任务不拦截内容, 不构成修改限制
export const hasPendingModeration = async (
  contentType: ModerationContentType,
  target: { contentId: number } | { userId: number }
) => {
  const count = await prisma.moderation_task.count({
    where: {
      content_type: contentType,
      status: { in: ['pending', 'manual'] },
      dry_run: false,
      ...('contentId' in target
        ? { content_id: target.contentId }
        : { user_id: target.userId })
    }
  })
  return count > 0
}

// 删除内容时清理尚未有最终裁决的任务 (pending / 失败转人工),
// 已 approved/rejected 的任务保留作历史记录.
// excludeDryRun: 内容仍存在 (管理员改 status) 时置 true —— dry_run 任务在 apply
// 中 claim 后即返回、永不改动内容, 无需作废, 保留其评估数据
export const deletePendingModerationTasks = async (
  contentType: ModerationContentType,
  contentId: number | number[],
  db: ModerationClient = prisma,
  excludeDryRun = false
) =>
  db.moderation_task.deleteMany({
    where: {
      content_type: contentType,
      content_id: Array.isArray(contentId) ? { in: contentId } : contentId,
      status: { in: ['pending', 'manual'] },
      ...(excludeDryRun ? { dry_run: false } : {})
    }
  })

export const createModerationTask = async (
  input: {
    contentType: ModerationContentType
    contentId?: number
    userId: number
    payload: ModerationPayload
    dryRun: boolean
  },
  db: ModerationClient = prisma
) => {
  const payload =
    'text' in input.payload
      ? { ...input.payload, text: prepareModerationText(input.payload.text) }
      : input.payload

  // an edit supersedes any verdict still in flight for the same content,
  // otherwise an older approval could land after this newer submission
  await db.moderation_task.updateMany({
    where: {
      content_type: input.contentType,
      status: 'pending',
      ...(input.contentId
        ? { content_id: input.contentId }
        : { user_id: input.userId })
    },
    data: { status: 'superseded' }
  })

  return db.moderation_task.create({
    data: {
      content_type: input.contentType,
      content_id: input.contentId ?? null,
      user_id: input.userId,
      payload: payload as unknown as Prisma.InputJsonValue,
      dry_run: input.dryRun
    }
  })
}
