import { describe, expect, it, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn()
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch: { findFirst: findFirstMock }
  }
}))

import { GET } from '../route'

const request = (query: string) =>
  new NextRequest(`http://localhost/api/edit/duplicate?${query}`)

describe('GET /api/edit/duplicate', () => {
  beforeEach(() => {
    findFirstMock.mockReset()
    findFirstMock.mockResolvedValue(null)
  })

  // 超出 int4 的值原样传给 Prisma 会抛 P2020 → 500。查重是输入即触发的只读探测，
  // 这类值在 patch 表里必然不存在，跳过条件既安全又不漏判
  it('超出 int4 的 bangumiId 不进入查询, 返回空对象', async () => {
    const res = await GET(request('bangumiId=9999999999'))

    expect(await res.json()).toEqual({})
    expect(findFirstMock).not.toHaveBeenCalled()
  })

  it('超出 int4 的 steamId 不进入查询, 返回空对象', async () => {
    const res = await GET(request('steamId=2147483648'))

    expect(await res.json()).toEqual({})
    expect(findFirstMock).not.toHaveBeenCalled()
  })

  it('int4 范围内的 bangumiId 正常查重', async () => {
    findFirstMock.mockResolvedValue({ unique_id: 'deadbeef' })

    const res = await GET(request('bangumiId=427846'))

    expect(await res.json()).toEqual({ uniqueId: 'deadbeef' })
    expect(findFirstMock).toHaveBeenCalledTimes(1)
    expect(findFirstMock.mock.calls[0][0].where).toEqual({
      OR: [{ bangumi_id: 427846 }]
    })
  })

  it('超出 int4 的 excludeId 只是不排除, 不影响其余条件', async () => {
    findFirstMock.mockResolvedValue({ unique_id: 'cafebabe' })

    const res = await GET(request('bangumiId=427846&excludeId=9999999999'))

    expect(await res.json()).toEqual({ uniqueId: 'cafebabe' })
    expect(findFirstMock.mock.calls[0][0].where.id).toBeUndefined()
  })

  // 指数记法可用 4 字符表达低于 int4 下界的整数, max(10) 限长挡不住
  it('低于 int4 下界的 bangumiId (-9e9) 不进入查询, 返回空对象', async () => {
    const res = await GET(request('bangumiId=-9e9'))

    expect(await res.json()).toEqual({})
    expect(findFirstMock).not.toHaveBeenCalled()
  })

  it('低于 int4 下界的 steamId (-9e9) 不进入查询, 返回空对象', async () => {
    const res = await GET(request('steamId=-9e9'))

    expect(await res.json()).toEqual({})
    expect(findFirstMock).not.toHaveBeenCalled()
  })

  it('低于 int4 下界的 excludeId (-9e9) 只是不排除, 不影响其余条件', async () => {
    findFirstMock.mockResolvedValue({ unique_id: 'cafebabe' })

    const res = await GET(request('bangumiId=427846&excludeId=-9e9'))

    expect(await res.json()).toEqual({ uniqueId: 'cafebabe' })
    expect(findFirstMock.mock.calls[0][0].where.id).toBeUndefined()
  })
})
