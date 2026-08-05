import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cookiesMock, loadAuthUserMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  loadAuthUserMock: vi.fn()
}))

vi.mock('react', () => ({
  cache: (fn: (...args: unknown[]) => unknown) => fn
}))

vi.mock('next/headers', () => ({
  cookies: cookiesMock
}))

vi.mock('~/utils/actions/loadAuthUser', () => ({
  loadAuthUser: loadAuthUserMock
}))

import {
  getAuthenticatedBlockedTagIds,
  getBlockedTagIds
} from '~/utils/actions/getBlockedTagIds'

const cacheKey = 'kun-patch-setting-store|state|data|kunBlockedTagIds'

const makeCookieStore = (map: Record<string, string | undefined>) => ({
  get: (name: string) =>
    map[name] === undefined ? undefined : { value: map[name] }
})

const setCookies = (map: Record<string, string | undefined>) => {
  cookiesMock.mockResolvedValue(makeCookieStore(map))
}

const payload = { uid: 1, name: 'kun', role: 1, iss: '', aud: '', jti: 'j' }

beforeEach(() => {
  vi.clearAllMocks()
  loadAuthUserMock.mockResolvedValue({
    payload,
    user: { id: 1, name: 'kun', role: 1, status: 0, blocked_tag_ids: [10, 20] }
  })
})

describe('getBlockedTagIds 镜像 cookie 验签与回落', () => {
  it('token 有效时采信镜像 cookie 的屏蔽标签', async () => {
    setCookies({ 'kun-galgame-patch-moe-token': 'tok', [cacheKey]: '[7,8]' })

    await expect(getBlockedTagIds()).resolves.toEqual([7, 8])
    expect(loadAuthUserMock).toHaveBeenCalledTimes(1)
  })

  it('token 无效时丢弃未验签的镜像 cookie', async () => {
    setCookies({ 'kun-galgame-patch-moe-token': 'tok', [cacheKey]: '[7,8]' })
    loadAuthUserMock.mockResolvedValue(null)

    await expect(getBlockedTagIds()).resolves.toEqual([])
  })

  it('无 token 时直接返回空且不查会话', async () => {
    setCookies({})

    await expect(getBlockedTagIds()).resolves.toEqual([])
    expect(loadAuthUserMock).not.toHaveBeenCalled()
  })

  // 真正的畸形转义 (%2) 在 next/headers 层就被丢弃走 DB; 这里覆盖的是
  // 「可解码但不可解析」的值, 曾被当成空列表把 DB 里的屏蔽列表短路掉
  it('不可解析的镜像 cookie 回落 DB', async () => {
    setCookies({ 'kun-galgame-patch-moe-token': 'tok', [cacheKey]: 'kun' })

    await expect(getBlockedTagIds()).resolves.toEqual([10, 20])
    expect(loadAuthUserMock).toHaveBeenCalledTimes(1)
  })
})

describe('getAuthenticatedBlockedTagIds 镜像 cookie 回落', () => {
  it('合法镜像 cookie 采信缓存值', async () => {
    setCookies({ 'kun-galgame-patch-moe-token': 'tok', [cacheKey]: '[1,2]' })

    await expect(getAuthenticatedBlockedTagIds()).resolves.toEqual({
      payload,
      blockedTagIds: [1, 2]
    })
  })

  it('不可解析的镜像 cookie 回落 DB 值', async () => {
    setCookies({ 'kun-galgame-patch-moe-token': 'tok', [cacheKey]: 'kun' })

    await expect(getAuthenticatedBlockedTagIds()).resolves.toEqual({
      payload,
      blockedTagIds: [10, 20]
    })
  })
})
