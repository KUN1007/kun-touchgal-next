import { prisma } from '~/prisma/index'
import { getRedirectConfig } from '~/app/api/admin/setting/redirect/getRedirectConfig'
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
  const redirectConfig = await getRedirectConfig()
  const responseData: UserState = {
    uid: user.id,
    name: user.name,
    avatar: user.avatar,
    bio: user.bio,
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
