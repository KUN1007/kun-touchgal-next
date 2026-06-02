import { NextRequest, NextResponse } from 'next/server'
import { kunParseFormData } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { prisma } from '~/prisma/index'
import { avatarSchema } from '~/validations/user'
import { purgeCloudflareCache } from '~/app/api/utils/purgeCloudflareCache'
import { uploadUserAvatar } from '../_upload'
import { invalidateUserSession } from '~/app/api/user/session/cache'

const getAvatarUrls = (uid: number) => {
  const imageBedUrl = process.env.KUN_VISUAL_NOVEL_IMAGE_BED_URL

  return {
    avatarUrl: `${imageBedUrl}/user/avatar/user_${uid}/avatar.avif`,
    avatarMiniUrl: `${imageBedUrl}/user/avatar/user_${uid}/avatar-mini.avif`
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

  const res = await uploadUserAvatar(avatar, uid)
  if (typeof res === 'string') {
    return res
  }

  const avatarVersion = Date.now().toString(36)
  const { avatarMiniUrl } = getAvatarUrls(uid)
  const imageLink = `${avatarMiniUrl}?v=${avatarVersion}`

  await prisma.user.update({
    where: { id: uid },
    data: { avatar: imageLink }
  })
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
