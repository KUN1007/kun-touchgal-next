import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cookieGetMock, loadAuthUserMock } = vi.hoisted(() => ({
  cookieGetMock: vi.fn(),
  loadAuthUserMock: vi.fn()
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookieGetMock })
}))

vi.mock('~/utils/actions/loadAuthUser', () => ({
  loadAuthUser: loadAuthUserMock
}))

import {
  getAuthenticatedBlockedTagIds,
  getBlockedTagIds
} from '~/utils/actions/getBlockedTagIds'

const cacheKey = 'kun-patch-setting-store|state|data|kunBlockedTagIds'

const setCookies = (map: Record<string, string>) => {
  cookieGetMock.mockImplementation((name: string) =>
    map[name] !== undefined ? { name, value: map[name] } : undefined
  )
}

const payload = { uid: 1, name: 'kun', role: 1, iss: '', aud: '', jti: 'j' }

beforeEach(() => {
  vi.clearAllMocks()
  loadAuthUserMock.mockResolvedValue({
    payload,
    user: { id: 1, name: 'kun', role: 1, status: 0, blocked_tag_ids: [10, 20] }
  })
})

describe('getBlockedTagIds 镜像 cookie 回落', () => {
  it('合法镜像 cookie 直接采信, 不查 DB', async () => {
    setCookies({ 'kun-galgame-patch-moe-token': 'tok', [cacheKey]: '[1,2]' })

    expect(await getBlockedTagIds()).toEqual([1, 2])
    expect(loadAuthUserMock).toHaveBeenCalledTimes(0)
  })

  // 真正的畸形转义 (%2) 在 next/headers 层就被丢弃走 DB; 这里覆盖的是
  // 「可解码但不可解析」的值, 曾被当成空列表把 DB 里的屏蔽列表短路掉
  it('不可解析的镜像 cookie 回落 DB', async () => {
    setCookies({ 'kun-galgame-patch-moe-token': 'tok', [cacheKey]: 'kun' })

    expect(await getBlockedTagIds()).toEqual([10, 20])
    expect(loadAuthUserMock).toHaveBeenCalledTimes(1)
  })
})

describe('getAuthenticatedBlockedTagIds 镜像 cookie 回落', () => {
  it('合法镜像 cookie 采信缓存值', async () => {
    setCookies({ 'kun-galgame-patch-moe-token': 'tok', [cacheKey]: '[1,2]' })

    expect(await getAuthenticatedBlockedTagIds()).toEqual({
      payload,
      blockedTagIds: [1, 2]
    })
  })

  it('不可解析的镜像 cookie 回落 DB 值', async () => {
    setCookies({ 'kun-galgame-patch-moe-token': 'tok', [cacheKey]: 'kun' })

    expect(await getAuthenticatedBlockedTagIds()).toEqual({
      payload,
      blockedTagIds: [10, 20]
    })
  })
})
