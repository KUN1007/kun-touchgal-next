import { NextRequest, NextResponse } from 'next/server'
import { kunParseFormData } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { prisma } from '~/prisma/index'
import { avatarSchema } from '~/validations/user'
import { purgeCloudflareCache } from '~/app/api/utils/purgeCloudflareCache'
import { getUserAvatarKeys, uploadUserAvatar } from '../_upload'
import { invalidateUserSession } from '~/app/api/user/session/cache'
import {
  createModerationTask,
  hasPendingModeration,
  preScreenMedia
} from '~/server/moderation/submit'

const getAvatarUrls = (uid: number) => {
  const imageBedUrl = process.env.KUN_VISUAL_NOVEL_IMAGE_BED_URL
  const keys = getUserAvatarKeys(uid)

  return {
    avatarUrl: `${imageBedUrl}/${keys.avatarKey}`,
    avatarMiniUrl: `${imageBedUrl}/${keys.avatarMiniKey}`
  }
}

const purgeCache = async (uid: number) => {
  const { avatarUrl, avatarMiniUrl } = getAvatarUrls(uid)

  return purgeCloudflareCache([avatarUrl, avatarMiniUrl])
}

const updateUserAvatar = async (uid: number, avatar: ArrayBuffer) => {
  const user = await prisma.user.findUnique({
    where: { id: uid }
  })
  if (!user) {
    return '用户未找到'
  }
  if (user.daily_image_count >= 50) {
    return '您今日上传的图片已达到 50 张限额'
  }
  if (await hasPendingModeration('avatar', { userId: uid })) {
    return '您提交的头像正在审核中, 暂时无法更换'
  }

  const moderation = await preScreenMedia()

  const res = await uploadUserAvatar(avatar, uid, moderation.intercept)
  if (typeof res === 'string') {
    return res
  }

  const avatarVersion = Date.now().toString(36)
  const { avatarMiniUrl } = getAvatarUrls(uid)
  const imageLink = `${avatarMiniUrl}?v=${avatarVersion}`

  const imageBedUrl = process.env.KUN_VISUAL_NOVEL_IMAGE_BED_URL
  const keys = getUserAvatarKeys(uid)

  if (moderation.intercept) {
    // 新头像暂存于 pending key, 通过审核后由 apply.ts 复制到正式 key
    const pendingLink = `${imageBedUrl}/${keys.pendingMiniKey}?v=${avatarVersion}`
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: uid },
        data: { avatar_status: 1 }
      })
      await createModerationTask(
        {
          contentType: 'avatar',
          userId: uid,
          payload: {
            pendingKey: keys.pendingKey,
            pendingMiniKey: keys.pendingMiniKey,
            avatarKey: keys.avatarKey,
            avatarMiniKey: keys.avatarMiniKey,
            avatarLink: imageLink,
            pendingLink
          },
          dryRun: false
        },
        tx
      )
    })
    await invalidateUserSession(uid)
    await purgeCloudflareCache([`${imageBedUrl}/${keys.pendingMiniKey}`])

    // 显性告知作者头像审核中: 返回 pending 预览与审核标志
    return { avatar: pendingLink, pending: true }
  }

  await prisma.user.update({
    where: { id: uid },
    data: { avatar: imageLink, avatar_status: 0 }
  })

  if (moderation.queue) {
    // dryRun: 头像直接生效, 任务仅记录 AI 裁决用于校准
    await createModerationTask({
      contentType: 'avatar',
      userId: uid,
      payload: {
        pendingKey: keys.avatarKey,
        pendingMiniKey: keys.avatarMiniKey,
        avatarKey: keys.avatarKey,
        avatarMiniKey: keys.avatarMiniKey,
        avatarLink: imageLink,
        pendingLink: imageLink
      },
      dryRun: true
    })
  }

  await invalidateUserSession(uid)
  await purgeCache(uid)

  return { avatar: imageLink }
}

export const POST = async (req: NextRequest) => {
  const input = await kunParseFormData(req, avatarSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const avatar = await new Response(input.avatar)?.arrayBuffer()

  const res = await updateUserAvatar(payload.uid, avatar)
  return NextResponse.json(res)
}
