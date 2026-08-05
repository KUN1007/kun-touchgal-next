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

import { getBlockedTagIds } from '~/utils/actions/getBlockedTagIds'

const makeCookieStore = (map: Record<string, string | undefined>) => ({
  get: (name: string) =>
    map[name] === undefined ? undefined : { value: map[name] }
})

const blockedCookies = {
  'kun-galgame-patch-moe-token': 'tok',
  'kun-patch-setting-store|state|data|kunBlockedTagIds': '[7,8]'
}

describe('getBlockedTagIds (server action) 镜像 cookie 验签', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('token 有效时采信镜像 cookie 的屏蔽标签', async () => {
    cookiesMock.mockResolvedValue(makeCookieStore(blockedCookies))
    loadAuthUserMock.mockResolvedValue({
      payload: { uid: 1 },
      user: { blocked_tag_ids: [1, 2] }
    })

    await expect(getBlockedTagIds()).resolves.toEqual([7, 8])
    expect(loadAuthUserMock).toHaveBeenCalledTimes(1)
  })

  it('token 无效时丢弃未验签的镜像 cookie', async () => {
    cookiesMock.mockResolvedValue(makeCookieStore(blockedCookies))
    loadAuthUserMock.mockResolvedValue(null)

    await expect(getBlockedTagIds()).resolves.toEqual([])
  })

  it('无 token 时直接返回空且不查会话', async () => {
    cookiesMock.mockResolvedValue(makeCookieStore({}))

    await expect(getBlockedTagIds()).resolves.toEqual([])
    expect(loadAuthUserMock).not.toHaveBeenCalled()
  })
})
