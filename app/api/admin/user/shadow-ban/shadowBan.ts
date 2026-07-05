import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { adminUpdateUserShadowBanSchema } from '~/validations/admin'

// 注意: 此处不可调用 deleteKunToken, 强制目标用户重新登录会暴露 shadow ban
export const updateUserShadowBan = async (
  input: z.infer<typeof adminUpdateUserShadowBanSchema>,
  adminUid: number
) => {
  const admin = await prisma.user.findUnique({ where: { id: adminUid } })
  if (!admin) {
    return '未找到该管理员'
  }

  const { uid, avatarShadowBan, bioShadowBan } = input
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: {
      id: true,
      name: true,
      avatar_shadow_ban: true,
      bio_shadow_ban: true
    }
  })
  if (!user) {
    return '未找到该用户'
  }

  await prisma.$transaction(async (prisma) => {
    await prisma.user.update({
      where: { id: uid },
      data: {
        avatar_shadow_ban: avatarShadowBan,
        bio_shadow_ban: bioShadowBan
      }
    })

    await prisma.admin_log.create({
      data: {
        type: 'update',
        user_id: adminUid,
        content: `管理员 ${admin.name} 更新了用户 ${user.name} (ID: ${uid}) 的屏蔽状态\n头像屏蔽: ${user.avatar_shadow_ban} -> ${avatarShadowBan}\n签名屏蔽: ${user.bio_shadow_ban} -> ${bioShadowBan}`
      }
    })
  })

  return {}
}
