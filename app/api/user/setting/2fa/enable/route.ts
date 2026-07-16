import { prisma } from '~/prisma/index'
import { NextRequest, NextResponse } from 'next/server'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { generateBackupCodes, Totp } from 'time2fa'
import { enableUser2FASchema } from '~/validations/user'
import { hashTwoFactorBackupCode } from '~/app/api/utils/twoFactorBackupCode'

const verifyAndEnable2FA = async (uid: number, token: string) => {
  const user = await prisma.user.findUnique({
    where: { id: uid }
  })

  if (!user || !user.two_factor_secret) {
    return '未找到 2FA 密钥, 请先生成 2FA 密钥'
  }

  const verified = Totp.validate({
    passcode: token,
    secret: user.two_factor_secret
  })

  if (!verified) {
    return '2FA 验证码无效'
  }

  const codes = generateBackupCodes()
  const hashedCodes = codes.map(hashTwoFactorBackupCode)

  await prisma.user.update({
    where: { id: uid },
    data: {
      enable_2fa: true,
      two_factor_backup: hashedCodes
    }
  })

  return { backupCode: codes }
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, enableUser2FASchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const result = await verifyAndEnable2FA(payload.uid, input.token)
  return NextResponse.json(result)
}
