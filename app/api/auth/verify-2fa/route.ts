import { z } from 'zod'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { generateKunToken } from '~/app/api/utils/jwt'
import { kunCookieOptions } from '~/app/api/utils/cookieOptions'
import { prisma } from '~/prisma/index'
import { getRedirectConfig } from '~/app/api/admin/setting/redirect/getRedirectConfig'
import { Totp } from 'time2fa'
import { parseCookies } from '~/utils/cookies'
import { verify2FA } from '~/app/api/utils/verify2FA'
import { verifyLogin2FASchema } from '~/validations/auth'
import type { UserState } from '~/store/userStore'

const verifyLogin2FA = async (
  input: z.infer<typeof verifyLogin2FASchema>,
  tempToken: string,
  uid: number
) => {
  const { token, isBackupCode } = input
  const payload = verify2FA(tempToken)
  if (!payload) {
    return '2FA 临时令牌已过期, 时效为 10 分钟'
  }

  const user = await prisma.user.findUnique({
    where: { id: uid }
  })

  if (!user || !user.enable_2fa) {
    return '用户未启用 2FA'
  }

  let isValid = false

  if (isBackupCode) {
    if (user.two_factor_backup.includes(token)) {
      isValid = true
      await prisma.user.update({
        where: { id: uid },
        data: {
          two_factor_backup: {
            set: user.two_factor_backup.filter((code) => code !== token)
          }
        }
      })
    }
  } else {
    isValid = Totp.validate({
      passcode: token,
      secret: user.two_factor_secret
    })
  }

  if (!isValid) {
    return '验证码无效'
  }

  const cookie = await cookies()
  cookie.delete('kun-galgame-patch-moe-2fa-token')

  const accessToken = await generateKunToken(
    user.id,
    user.name,
    user.role,
    '30d'
  )
  cookie.set(
    'kun-galgame-patch-moe-token',
    accessToken,
    kunCookieOptions(30 * 24 * 60 * 60)
  )

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

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, verifyLogin2FASchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const tempToken = parseCookies(req.headers.get('cookie') ?? '')[
    'kun-galgame-patch-moe-2fa-token'
  ]
  if (!tempToken) {
    return NextResponse.json('未找到临时令牌')
  }
  const payload = verify2FA(tempToken)
  if (!payload) {
    return NextResponse.json('2FA 临时令牌已过期, 时效为 10 分钟')
  }

  const response = await verifyLogin2FA(input, tempToken, payload.id)
  return NextResponse.json(response)
}
