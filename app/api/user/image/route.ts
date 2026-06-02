import { NextRequest, NextResponse } from 'next/server'
import { kunParseFormData } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { prisma } from '~/prisma/index'
import { uploadIntroductionImage } from './_upload'
import { imageSchema } from '~/validations/edit'
import { invalidateUserSession } from '~/app/api/user/session/cache'

const uploadImage = async (uid: number, image: ArrayBuffer) => {
  const user = await prisma.user.findUnique({
    where: { id: uid }
  })
  if (!user) {
    return '用户未找到'
  }
  if (user.daily_image_count >= 50) {
    return '您今日上传的图片已达到 50 张限额'
  }

  const newFileName = `${uid}-${Date.now()}`

  const res = await uploadIntroductionImage(newFileName, image, uid)
  if (typeof res === 'string') {
    return res
  }

  await prisma.user.update({
    where: { id: uid },
    data: { daily_image_count: { increment: 1 } }
  })
  await invalidateUserSession(uid)

  const imageLink = `${process.env.KUN_VISUAL_NOVEL_IMAGE_BED_URL}/user/image/${uid}/${newFileName}.avif`
  return { imageLink }
}

export const POST = async (req: NextRequest) => {
  const input = await kunParseFormData(req, imageSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const image = await new Response(input.image)?.arrayBuffer()

  const res = await uploadImage(payload.uid, image)
  return NextResponse.json(res)
}
