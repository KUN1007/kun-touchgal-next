import { prisma } from '~/prisma/index'
import { getRedirectConfig } from '~/app/api/admin/setting/redirect/getRedirectConfig'
import type { UserState } from '~/store/userStore'

export const getUserStatus = async (uid: number) => {
  const user = await prisma.user.findUnique({
    where: { id: uid }
  })
  if (!user) {
    return '用户未找到'
  }

  await prisma.user.update({
    where: { id: uid },
    data: { last_login_time: { set: Date.now().toString() } }
  })

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
