import { z } from 'zod'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  needsPasswordRehash,
  verifyPassword
} from '~/app/api/utils/algorithm'
import {
  generateKunStatelessToken,
  generateKunToken
} from '~/app/api/utils/jwt'
import { loginSchema } from '~/validations/auth'
import { prisma } from '~/prisma/index'
import { checkKunCaptchaExist } from '~/app/api/utils/verifyKunCaptcha'
import { getRedirectConfig } from '~/app/api/admin/setting/redirect/getRedirectConfig'
import type { UserState } from '~/store/userStore'

const upgradePasswordHash = async (
  userId: number,
  password: string,
  previousPasswordHash: string
) => {
  try {
    await prisma.user.updateMany({
      where: { id: userId, password: previousPasswordHash },
      data: { password: await hashPassword(password) }
    })
  } catch {
    return
  }
}

const login = async (
  input: z.infer<typeof loginSchema>
): Promise<UserState | ({ require2FA: boolean } & KunUser) | string> => {
  const { name, password, captcha } = input
  const res = await checkKunCaptchaExist(captcha)
  if (!res) {
    return '人机验证无效, 请完成人机验证'
  }

  const normalizedName = name.toLowerCase()
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: normalizedName, mode: 'insensitive' } },
        { name: { equals: normalizedName, mode: 'insensitive' } }
      ]
    }
  })

  const isPasswordValid = await verifyPassword(
    password,
    user?.password ?? DUMMY_PASSWORD_HASH
  )
  if (!user || !isPasswordValid) {
    return '用户名或密码错误'
  }
  if (user.status === 2) {
    return '该用户已被封禁, 如果您觉得有任何问题, 请联系我们'
  }

  if (needsPasswordRehash(user.password)) {
    await upgradePasswordHash(user.id, password, user.password)
  }

  if (user.enable_2fa) {
    const tempToken = generateKunStatelessToken(
      { id: user.id, require2FA: true },
      10 * 60
    )
    const cookie = await cookies()
    cookie.set('kun-galgame-patch-moe-2fa-token', tempToken, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 10 * 60 * 1000
    })
    return {
      require2FA: true,
      id: user.id,
      name: user.name,
      avatar: user.avatar
    }
  }

  const token = await generateKunToken(user.id, user.name, user.role, '30d')
  const cookie = await cookies()
  cookie.set('kun-galgame-patch-moe-token', token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000
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

  return { ...responseData, require2FA: false }
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, loginSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const response = await login(input)
  return NextResponse.json(response)
}
