import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  kvStore,
  lockStore,
  getKvMock,
  setKvMock,
  setKvIfAbsentMock,
  delKvMock,
  acquireKvLockMock,
  releaseKvLockMock,
  countMock,
  rootFindManyMock,
  likeFindManyMock,
  queryRawMock,
  updateManyMock
} = vi.hoisted(() => {
  const kvStore = new Map<string, string>()
  const lockStore = new Set<string>()

  return {
    kvStore,
    lockStore,
    getKvMock: vi.fn(async (key: string) => kvStore.get(key) ?? null),
    setKvMock: vi.fn(async (key: string, value: string) => {
      kvStore.set(key, value)
    }),
    setKvIfAbsentMock: vi.fn(async (key: string, value: string) => {
      if (!kvStore.has(key)) {
        kvStore.set(key, value)
      }
    }),
    delKvMock: vi.fn(async (key: string) => {
      kvStore.delete(key)
    }),
    acquireKvLockMock: vi.fn(async (key: string) => {
      if (lockStore.has(key)) {
        return null
      }
      lockStore.add(key)
      return 'lock-token'
    }),
    releaseKvLockMock: vi.fn(async (key: string) => {
      lockStore.delete(key)
    }),
    countMock: vi.fn(),
    rootFindManyMock: vi.fn(),
    likeFindManyMock: vi.fn(),
    queryRawMock: vi.fn(),
    updateManyMock: vi.fn(async () => ({ count: 1 }))
  }
})

vi.mock('~/lib/redis', () => ({
  getKv: getKvMock,
  setKv: setKvMock,
  setKvIfAbsent: setKvIfAbsentMock,
  delKv: delKvMock,
  acquireKvLock: acquireKvLockMock,
  releaseKvLock: releaseKvLockMock
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_comment: {
      count: countMock,
      findMany: rootFindManyMock,
      updateMany: updateManyMock
    },
    user_patch_comment_like_relation: {
      findMany: likeFindManyMock
    },
    $queryRaw: queryRawMock
  }
}))

vi.mock('~/app/api/utils/render/markdownToHtmlComment', () => ({
  COMMENT_HTML_VERSION: 1,
  markdownToHtmlComment: vi.fn(async (markdown: string) => `<p>${markdown}</p>`)
}))

import { getPatchComment } from '~/app/api/patch/comment/get'
import { invalidatePatchCommentCache } from '~/app/api/patch/comment/cache'

const rootComment = {
  id: 100,
  content: 'hello',
  content_html: '<p>hello</p>',
  content_html_version: 1,
  is_spoiler: false,
  status: 0,
  parent_id: null,
  user_id: 5,
  patch_id: 10,
  created: new Date('2026-01-01T00:00:00.000Z'),
  updated: new Date('2026-01-01T00:00:00.000Z'),
  user: { id: 5, name: 'author', avatar: '' },
  patch: { unique_id: 'patch-10' },
  _count: { like_by: 3 }
}

const input = { patchId: 10, page: 1, limit: 10 }
const viewer = { uid: 7, role: 1 }
const adminViewer = { uid: 9, role: 3 }

beforeEach(() => {
  vi.clearAllMocks()
  kvStore.clear()
  lockStore.clear()
  // where.status === 1 是 bypass 检查 (用户自己的待审评论数), 其余是根评论总数
  countMock.mockImplementation(
    async ({ where }: { where: { status?: number } }) =>
      where.status === 1 ? 0 : 1
  )
  rootFindManyMock.mockResolvedValue([rootComment])
  likeFindManyMock.mockResolvedValue([])
  queryRawMock.mockResolvedValue([])
})

describe('getPatchComment 缓存', () => {
  it('缓存命中时不重建评论树', async () => {
    await getPatchComment(input, viewer)
    rootFindManyMock.mockClear()

    const result = await getPatchComment(input, viewer)

    expect(rootFindManyMock).not.toHaveBeenCalled()
    expect(result.comments[0].id).toBe(100)
    expect(result.total).toBe(1)
  })

  it('命中缓存后仍按 uid 叠加 isLike, 不受基线影响', async () => {
    await getPatchComment(input, viewer)
    likeFindManyMock.mockResolvedValueOnce([{ comment_id: 100 }])

    const result = await getPatchComment(input, viewer)

    expect(rootFindManyMock).toHaveBeenCalledTimes(1)
    expect(result.comments[0].isLike).toBe(true)
  })

  it('管理员绕过共享缓存, 不读版本键, 每次重建', async () => {
    await getPatchComment(input, adminViewer)
    await getPatchComment(input, adminViewer)

    expect(getKvMock).not.toHaveBeenCalled()
    expect(rootFindManyMock).toHaveBeenCalledTimes(2)
  })

  it('有自己待审评论的用户绕过共享缓存', async () => {
    countMock.mockImplementation(
      async ({ where }: { where: { status?: number } }) =>
        where.status === 1 ? 2 : 1
    )

    await getPatchComment(input, viewer)
    await getPatchComment(input, viewer)

    expect(getKvMock).not.toHaveBeenCalled()
    expect(rootFindManyMock).toHaveBeenCalledTimes(2)
  })

  it('失效后重新回源', async () => {
    await getPatchComment(input, viewer)
    rootFindManyMock.mockClear()

    await invalidatePatchCommentCache(10)
    const result = await getPatchComment(input, viewer)

    expect(rootFindManyMock).toHaveBeenCalledTimes(1)
    expect(result.comments[0].id).toBe(100)
  })

  it('版本过期的历史评论回落渲染并写回自愈', async () => {
    rootFindManyMock.mockResolvedValueOnce([
      { ...rootComment, content_html: '<p>old</p>', content_html_version: 0 }
    ])

    const result = await getPatchComment(input, viewer)

    // 版本不匹配 → 回落 markdownToHtmlComment (mock: `<p>${content}</p>`)
    expect(result.comments[0].content).toBe('<p>hello</p>')
    // fire-and-forget 写回, flush 微任务后断言幂等前置条件 (updated 用于防止并发修改时误写旧渲染)
    await Promise.resolve()
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        id: 100,
        content_html_version: { not: 1 },
        updated: new Date('2026-01-01T00:00:00.000Z')
      },
      data: { content_html: '<p>hello</p>', content_html_version: 1 }
    })
  })
})
