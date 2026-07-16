import { NextRequest, NextResponse } from 'next/server'
import { parseCookies } from '~/utils/cookies'
import { verify2FA } from '~/app/api/utils/verify2FA'
import { isTwoFactorChallengeActive } from '~/app/api/auth/_twoFactorChallenge'

export const GET = async (req: NextRequest) => {
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

  try {
    const isActive = await isTwoFactorChallengeActive(payload.jti, payload.id)
    if (!isActive) {
      return NextResponse.json('2FA 临时令牌已失效, 请重新登录')
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to check 2FA challenge', error)
    return NextResponse.json('2FA 验证服务暂不可用, 请稍后重试')
  }

  return NextResponse.json(payload)
}
