import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { verifyKunTokenMock, verifyKunTokenWithUserMock } = vi.hoisted(() => ({
  verifyKunTokenMock: vi.fn(),
  verifyKunTokenWithUserMock: vi.fn()
}))

vi.mock('~/app/api/utils/jwt', () => ({
  verifyKunToken: verifyKunTokenMock,
  verifyKunTokenWithUser: verifyKunTokenWithUserMock
}))

import { createAuthLoader } from '~/middleware/_verifyHeaderCookie'
import { getPatchVisibilityWhere } from '~/app/api/utils/getPatchVisibilityWhere'

// 最坏场景: 有 token + NSFW 受限 + 无 blocked-tag cookie
// -> verifyHeaderCookie / getBlockedTagIds / getNSFWHeader 三条支路都需要验证
const worstCaseCookie =
  'kun-galgame-patch-moe-token=tok; kun-patch-setting-store|state|data|kunNsfwEnable=all'

const makeReq = (cookie: string) =>
  ({
    headers: { get: (key: string) => (key === 'cookie' ? cookie : null) }
  }) as unknown as NextRequest

const payload = { uid: 1, name: 'kun', role: 1, iss: '', aud: '', jti: 'j' }

beforeEach(() => {
  vi.clearAllMocks()
  verifyKunTokenMock.mockResolvedValue(payload)
  verifyKunTokenWithUserMock.mockResolvedValue({
    payload,
    user: { id: 1, name: 'kun', role: 1, status: 0, blocked_tag_ids: [10, 20] }
  })
})

describe('getPatchVisibilityWhere auth 去重', () => {
  it('传入 loadAuth 时同请求内底层只验证一次', async () => {
    const req = makeReq(worstCaseCookie)
    const loadAuth = createAuthLoader(req)

    // 模拟热点 route: getPatchVisibilityWhere 与 route 层的 payload 并行取用同一 loader
    await Promise.all([getPatchVisibilityWhere(req, loadAuth), loadAuth()])

    expect(verifyKunTokenWithUserMock).toHaveBeenCalledTimes(1)
    // getNSFWHeader 复用 loadAuth 的 payload, 不再自行 verifyKunToken
    expect(verifyKunTokenMock).toHaveBeenCalledTimes(0)
  })

  it('不传 loadAuth 时保持原有各自验证的行为', async () => {
    const req = makeReq(worstCaseCookie)

    await getPatchVisibilityWhere(req)

    expect(verifyKunTokenWithUserMock).toHaveBeenCalledTimes(1) // getBlockedTagIds
    expect(verifyKunTokenMock).toHaveBeenCalledTimes(1) // getNSFWHeader
  })
})
