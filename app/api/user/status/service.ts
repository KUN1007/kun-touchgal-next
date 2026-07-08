import { prisma } from '~/prisma/index'
import { getRedirectConfig } from '~/app/api/admin/setting/redirect/getRedirectConfig'
import { getModerationConfig } from '~/server/moderation/config'
import { acquireKvLock, setKv } from '~/lib/redis'
import type { UserState } from '~/store/userStore'

const USER_LAST_ACTIVE_TTL_SECONDS = 60 * 60

const getUserLastActiveKey = (uid: number) => `session:user:last-active:${uid}`

const markUserLastActive = async (uid: number) => {
  await setKv(
    getUserLastActiveKey(uid),
    '1',
    USER_LAST_ACTIVE_TTL_SECONDS
  ).catch(() => undefined)
}

export const updateUserLastLoginTime = async (uid: number) => {
  await prisma.user.update({
    where: { id: uid },
    data: { last_login_time: { set: Date.now().toString() } }
  })
  await markUserLastActive(uid)
}

export const touchUserLastActiveTime = async (uid: number) => {
  const lockToken = await acquireKvLock(
    getUserLastActiveKey(uid),
    USER_LAST_ACTIVE_TTL_SECONDS
  ).catch(() => null)
  if (!lockToken) {
    return
  }

  await prisma.user
    .update({
      where: { id: uid },
      data: { last_login_time: { set: Date.now().toString() } }
    })
    .catch(() => undefined)
}

// 本人视角合并审核中的头像/签名暂存值, 保证提交后刷新页面显示一致
const getPendingProfileValues = async (uid: number) => {
  // 审核关闭时不产生新任务, 跳过查询避免会话路径的额外开销
  const config = await getModerationConfig()
  if (!config.enabled) {
    return { pendingAvatar: undefined, pendingBio: undefined }
  }

  const pendingTasks = await prisma.moderation_task.findMany({
    where: {
      user_id: uid,
      // 与 hasPendingModeration 对齐: 转人工 (manual) 期间仍向作者展示送审新值,
      // 避免锁定生效但预览回退旧值的错位
      status: { in: ['pending', 'manual'] },
      dry_run: false,
      content_type: { in: ['avatar', 'bio'] }
    },
    orderBy: { created: 'desc' }
  })

  const avatarTask = pendingTasks.find((t) => t.content_type === 'avatar')
  const bioTask = pendingTasks.find((t) => t.content_type === 'bio')
  const avatarPayload = avatarTask?.payload as { pendingLink?: string } | null
  const bioPayload = bioTask?.payload as { bio?: string } | null

  return {
    pendingAvatar: avatarPayload?.pendingLink,
    pendingBio: bioPayload?.bio
  }
}

export const getUserStatus = async (uid: number) => {
  const user = await prisma.user.findUnique({
    where: { id: uid }
  })
  if (!user) {
    return '用户未找到'
  }
  if (user.status === 2) {
    return '用户登陆失效'
  }
  const { pendingAvatar, pendingBio } = await getPendingProfileValues(uid)
  const redirectConfig = await getRedirectConfig()
  const responseData: UserState = {
    uid: user.id,
    name: user.name,
    avatar: pendingAvatar ?? user.avatar,
    bio: pendingBio ?? user.bio,
    moemoepoint: user.moemoepoint,
    role: user.role,
    dailyCheckIn: user.daily_check_in,
    dailyImageLimit: user.daily_image_count,
    dailyUploadLimit: user.daily_upload_size,
    enableEmailNotice: user.enable_email_notice,
    allowPrivateMessage: user.allow_private_message,
    blockedTagIds: user.blocked_tag_ids,
    ...redirectConfig
  }

  return responseData
}
