import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  parsePutBodyMock,
  verifyHeaderCookieMock,
  getRemoteIpMock,
  setKvIfAbsentMock,
  delKvMock,
  linkFindUniqueMock,
  patchUpdateMock,
  resourceUpdateMock,
  linkUpdateMock,
  transactionMock,
  invalidateStatsMock
} = vi.hoisted(() => ({
  parsePutBodyMock: vi.fn(),
  verifyHeaderCookieMock: vi.fn(),
  getRemoteIpMock: vi.fn(),
  setKvIfAbsentMock: vi.fn(),
  delKvMock: vi.fn(),
  linkFindUniqueMock: vi.fn(),
  patchUpdateMock: vi.fn(),
  resourceUpdateMock: vi.fn(),
  linkUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
  invalidateStatsMock: vi.fn()
}))

const transactionClient = {
  patch_resource_link: {
    findUnique: linkFindUniqueMock,
    update: linkUpdateMock
  },
  patch: { update: patchUpdateMock },
  patch_resource: { update: resourceUpdateMock }
}

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' }
      })
  }
}))

vi.mock('~/app/api/utils/parseQuery', () => ({
  kunParsePutBody: parsePutBodyMock
}))

vi.mock('~/middleware/_verifyHeaderCookie', () => ({
  verifyHeaderCookie: verifyHeaderCookieMock
}))

vi.mock('~/app/api/utils/getRemoteIp', () => ({
  getRemoteIp: getRemoteIpMock
}))

vi.mock('~/lib/redis', () => ({
  setKvIfAbsent: setKvIfAbsentMock,
  delKv: delKvMock
}))

vi.mock('~/app/api/resource/cache', () => ({
  invalidateResourceStatsListCache: invalidateStatsMock
}))

vi.mock('~/prisma/index', () => ({
  prisma: { $transaction: transactionMock }
}))

import { PUT } from '~/app/api/patch/resource/download/route'

const mockRequest = new Request('http://localhost') as unknown as Parameters<
  typeof PUT
>[0]

const validInput = { patchId: 10, resourceId: 5, linkId: 2 }
const matchingLink = { resource_id: 5, resource: { patch_id: 10 } }

beforeEach(() => {
  vi.clearAllMocks()
  parsePutBodyMock.mockResolvedValue(validInput)
  verifyHeaderCookieMock.mockResolvedValue({ uid: 99 })
  getRemoteIpMock.mockReturnValue('1.2.3.4')
  setKvIfAbsentMock.mockResolvedValue(true)
  delKvMock.mockResolvedValue(undefined)
  linkFindUniqueMock.mockResolvedValue(matchingLink)
  patchUpdateMock.mockResolvedValue({})
  resourceUpdateMock.mockResolvedValue({})
  linkUpdateMock.mockResolvedValue({})
  invalidateStatsMock.mockResolvedValue(undefined)
  transactionMock.mockImplementation(
    async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient)
  )
})

describe('PUT /api/patch/resource/download', () => {
  it('合法链条时三张表各自增一次并失效统计缓存', async () => {
    const res = await PUT(mockRequest)
    await expect(res.json()).resolves.toEqual({})

    expect(patchUpdateMock).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { download: { increment: 1 } }
    })
    expect(resourceUpdateMock).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { download: { increment: 1 } }
    })
    expect(linkUpdateMock).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { download: { increment: 1 } }
    })
    expect(invalidateStatsMock).toHaveBeenCalledTimes(1)
  })

  it('去重命中时短路: 不查库、不自增、不失效缓存', async () => {
    setKvIfAbsentMock.mockResolvedValue(false)

    const res = await PUT(mockRequest)
    await expect(res.json()).resolves.toEqual({})

    expect(transactionMock).not.toHaveBeenCalled()
    expect(patchUpdateMock).not.toHaveBeenCalled()
    expect(invalidateStatsMock).not.toHaveBeenCalled()
  })

  it('resource 不属于该 patch 时拒绝, 不自增并释放去重槽', async () => {
    linkFindUniqueMock.mockResolvedValue({
      resource_id: 5,
      resource: { patch_id: 999 }
    })

    const res = await PUT(mockRequest)
    await expect(res.json()).resolves.toBe('资源不存在')

    expect(patchUpdateMock).not.toHaveBeenCalled()
    expect(resourceUpdateMock).not.toHaveBeenCalled()
    expect(linkUpdateMock).not.toHaveBeenCalled()
    expect(invalidateStatsMock).not.toHaveBeenCalled()
    expect(delKvMock).toHaveBeenCalledWith('download:dedup:u:99:2')
  })

  it('link 不属于该 resource 时拒绝并释放去重槽', async () => {
    linkFindUniqueMock.mockResolvedValue({
      resource_id: 7,
      resource: { patch_id: 10 }
    })

    const res = await PUT(mockRequest)
    await expect(res.json()).resolves.toBe('资源不存在')

    expect(patchUpdateMock).not.toHaveBeenCalled()
    expect(delKvMock).toHaveBeenCalledWith('download:dedup:u:99:2')
  })

  it('linkId 不存在时拒绝并释放去重槽', async () => {
    linkFindUniqueMock.mockResolvedValue(null)

    const res = await PUT(mockRequest)
    await expect(res.json()).resolves.toBe('资源不存在')
    expect(delKvMock).toHaveBeenCalledWith('download:dedup:u:99:2')
  })

  it('匿名请求以 IP 作为去重身份', async () => {
    verifyHeaderCookieMock.mockResolvedValue(null)

    await PUT(mockRequest)

    expect(setKvIfAbsentMock).toHaveBeenCalledWith(
      'download:dedup:ip:1.2.3.4:2',
      '1',
      expect.any(Number)
    )
  })

  it('已登录请求以 uid 作为去重身份', async () => {
    await PUT(mockRequest)

    expect(setKvIfAbsentMock).toHaveBeenCalledWith(
      'download:dedup:u:99:2',
      '1',
      expect.any(Number)
    )
  })
})
