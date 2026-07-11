import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GALGAME_FILTER_VALUE,
  DEFAULT_GALGAME_MONTH_STRING,
  DEFAULT_GALGAME_SORT_FIELD,
  DEFAULT_GALGAME_SORT_ORDER,
  DEFAULT_GALGAME_YEAR_STRING
} from '~/utils/galgameFilter'

const { getTagByIdMock, getPatchByTagMock, getPatchVisibilityContextMock } =
  vi.hoisted(() => ({
    getTagByIdMock: vi.fn(),
    getPatchByTagMock: vi.fn(),
    getPatchVisibilityContextMock: vi.fn()
  }))

vi.mock('react', () => ({
  cache: <Args extends unknown[], Result>(fn: (...args: Args) => Result) => {
    const entries: Array<{ args: Args; result: Result }> = []

    return (...args: Args): Result => {
      const cached = entries.find(
        (entry) =>
          entry.args.length === args.length &&
          entry.args.every((argument, index) =>
            Object.is(argument, args[index])
          )
      )
      if (cached) {
        return cached.result
      }

      const result = fn(...args)
      entries.push({ args, result })
      return result
    }
  }
}))

vi.mock('~/app/api/tag/get', () => ({
  getTagById: getTagByIdMock
}))

vi.mock('~/app/api/tag/galgame/service', () => ({
  getPatchByTag: getPatchByTagMock
}))

vi.mock('~/utils/actions/getPatchVisibilityContext', () => ({
  getPatchVisibilityContext: getPatchVisibilityContextMock
}))

import { kunGetTagByIdActions, kunGetTagPageDataActions } from '../actions'

beforeEach(() => {
  vi.clearAllMocks()
  getPatchVisibilityContextMock.mockResolvedValue({
    blockedTagIds: [],
    nsfwWhere: {}
  })
})

describe('kunGetTagByIdActions', () => {
  it('deduplicates equivalent tag lookups by primitive tagId', async () => {
    const tag = { id: 7, name: '测试标签' }
    getTagByIdMock.mockResolvedValue(tag)

    const [first, second] = await Promise.all([
      kunGetTagByIdActions({ tagId: 7 }),
      kunGetTagByIdActions({ tagId: 7 })
    ])

    expect(first).toEqual(tag)
    expect(second).toEqual(tag)
    expect(getTagByIdMock).toHaveBeenCalledTimes(1)
    expect(getTagByIdMock).toHaveBeenCalledWith({ tagId: 7 })
  })
})

describe('kunGetTagPageDataActions', () => {
  const patchParams = {
    page: 1,
    limit: 24,
    selectedType: DEFAULT_GALGAME_FILTER_VALUE,
    selectedLanguage: DEFAULT_GALGAME_FILTER_VALUE,
    selectedPlatform: DEFAULT_GALGAME_FILTER_VALUE,
    sortField: DEFAULT_GALGAME_SORT_FIELD,
    sortOrder: DEFAULT_GALGAME_SORT_ORDER,
    yearString: DEFAULT_GALGAME_YEAR_STRING,
    monthString: DEFAULT_GALGAME_MONTH_STRING,
    minRatingCount: 0
  }

  it('starts the patch query before the tag query settles', async () => {
    let resolveTag: ((value: { id: number; name: string }) => void) | undefined
    const pendingTag = new Promise<{ id: number; name: string }>((resolve) => {
      resolveTag = resolve
    })
    const tag = { id: 8, name: '并行标签' }
    const response = { galgames: [], total: 0 }
    getTagByIdMock.mockReturnValue(pendingTag)
    getPatchByTagMock.mockResolvedValue(response)

    const pageDataPromise = kunGetTagPageDataActions({
      ...patchParams,
      tagId: tag.id
    })

    await vi.waitFor(() => {
      expect(getPatchByTagMock).toHaveBeenCalledTimes(1)
    })

    resolveTag?.(tag)
    await expect(pageDataPromise).resolves.toEqual({ tag, response })
  })

  it('keeps tag errors ahead of patch errors', async () => {
    getTagByIdMock.mockResolvedValue('标签不存在')
    getPatchByTagMock.mockResolvedValue('作品查询失败')

    await expect(
      kunGetTagPageDataActions({ ...patchParams, tagId: 9 })
    ).resolves.toBe('标签不存在')
  })

  it('returns the patch error after a successful tag lookup', async () => {
    getTagByIdMock.mockResolvedValue({ id: 10, name: '测试标签' })
    getPatchByTagMock.mockResolvedValue('作品查询失败')

    await expect(
      kunGetTagPageDataActions({ ...patchParams, tagId: 10 })
    ).resolves.toBe('作品查询失败')
  })

  it('keeps a missing-tag error when the concurrent patch query rejects', async () => {
    let resolveTag: ((value: string) => void) | undefined
    const pendingTag = new Promise<string>((resolve) => {
      resolveTag = resolve
    })
    getTagByIdMock.mockReturnValue(pendingTag)
    getPatchByTagMock.mockRejectedValue(new Error('数据库不可用'))

    const pageDataPromise = kunGetTagPageDataActions({
      ...patchParams,
      tagId: 11
    })
    await vi.waitFor(() => {
      expect(getPatchByTagMock).toHaveBeenCalledTimes(1)
    })

    resolveTag?.('未找到标签')
    await expect(pageDataPromise).resolves.toBe('未找到标签')
  })

  it('rethrows a patch failure after a successful tag lookup', async () => {
    const error = new Error('数据库不可用')
    getTagByIdMock.mockResolvedValue({ id: 12, name: '测试标签' })
    getPatchByTagMock.mockRejectedValue(error)

    await expect(
      kunGetTagPageDataActions({ ...patchParams, tagId: 12 })
    ).rejects.toBe(error)
  })
})
