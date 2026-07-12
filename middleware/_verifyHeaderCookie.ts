import { parseCookies } from '~/utils/cookies'
import { verifyKunToken, verifyKunTokenWithUser } from '~/app/api/utils/jwt'
import type { NextRequest } from 'next/server'

export const verifyHeaderCookie = async (req: NextRequest) => {
  const token = parseCookies(req.headers.get('cookie') ?? '')[
    'kun-galgame-patch-moe-token'
  ]
  const payload = await verifyKunToken(token ?? '')

  return payload
}

// 请求级 memo: 同一请求内多处需要鉴权时只跑一次 verifyAndLoadUser
// (verifyHeaderCookie / getBlockedTagIds / getNSFWHeader 共享同一次 user.findUnique)
export const createAuthLoader = (req: NextRequest) => {
  const token =
    parseCookies(req.headers.get('cookie') ?? '')[
      'kun-galgame-patch-moe-token'
    ] ?? ''
  let cached: ReturnType<typeof verifyKunTokenWithUser> | undefined
  return () => (cached ??= verifyKunTokenWithUser(token))
}

export type AuthLoader = ReturnType<typeof createAuthLoader>
