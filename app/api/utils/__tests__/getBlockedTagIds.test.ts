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

import {
  getAuthenticatedBlockedTagIds,
  getBlockedTagIds
} from '~/app/api/utils/getBlockedTagIds'

const cacheKey = 'kun-patch-setting-store|state|data|kunBlockedTagIds'

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

describe('getBlockedTagIds 镜像 cookie 回落', () => {
  it('合法镜像 cookie 验签后采信, 不全查 DB', async () => {
    const req = makeReq(`kun-galgame-patch-moe-token=tok; ${cacheKey}=[1,2]`)

    expect(await getBlockedTagIds(req)).toEqual([1, 2])
    expect(verifyKunTokenMock).toHaveBeenCalledTimes(1)
    expect(verifyKunTokenWithUserMock).toHaveBeenCalledTimes(0)
  })

  // 曾在此分裂: parseCookies 对畸形转义回落原值, 缓存分支拿到 '%2' 解析失败
  // 返回 [], 而 Server Component 侧 next/headers 丢弃该 cookie 走 DB
  it('畸形镜像 cookie 回落 DB, 与 Server Component 侧一致', async () => {
    const req = makeReq(`kun-galgame-patch-moe-token=tok; ${cacheKey}=%2`)

    expect(await getBlockedTagIds(req)).toEqual([10, 20])
    expect(verifyKunTokenWithUserMock).toHaveBeenCalledTimes(1)
  })

  it('空数组镜像 cookie 是合法缓存, 不回落 DB', async () => {
    const req = makeReq(`kun-galgame-patch-moe-token=tok; ${cacheKey}=[]`)

    expect(await getBlockedTagIds(req)).toEqual([])
    expect(verifyKunTokenWithUserMock).toHaveBeenCalledTimes(0)
  })
})

describe('getAuthenticatedBlockedTagIds 镜像 cookie 回落', () => {
  it('合法镜像 cookie 只验签, 不查 DB', async () => {
    const req = makeReq(`kun-galgame-patch-moe-token=tok; ${cacheKey}=[1,2]`)

    expect(await getAuthenticatedBlockedTagIds(req)).toEqual([1, 2])
    expect(verifyKunTokenMock).toHaveBeenCalledTimes(1)
    expect(verifyKunTokenWithUserMock).toHaveBeenCalledTimes(0)
  })

  it('畸形镜像 cookie 回落 DB 全查', async () => {
    const req = makeReq(`kun-galgame-patch-moe-token=tok; ${cacheKey}=100%`)

    expect(await getAuthenticatedBlockedTagIds(req)).toEqual([10, 20])
    expect(verifyKunTokenMock).toHaveBeenCalledTimes(0)
    expect(verifyKunTokenWithUserMock).toHaveBeenCalledTimes(1)
  })

  // null 只表示未认证, 坏缓存不改变这一语义
  it('畸形镜像 cookie 且 token 无效时仍返回 null', async () => {
    verifyKunTokenWithUserMock.mockResolvedValue(null)
    const req = makeReq(`kun-galgame-patch-moe-token=tok; ${cacheKey}=100%`)

    expect(await getAuthenticatedBlockedTagIds(req)).toBeNull()
  })
})
