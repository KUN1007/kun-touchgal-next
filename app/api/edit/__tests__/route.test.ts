import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { verifyHeaderCookieMock, createGalgameMock, updateGalgameMock } =
  vi.hoisted(() => ({
    verifyHeaderCookieMock: vi.fn(),
    createGalgameMock: vi.fn(),
    updateGalgameMock: vi.fn()
  }))

vi.mock('~/middleware/_verifyHeaderCookie', () => ({
  verifyHeaderCookie: verifyHeaderCookieMock
}))

// create / update 间接拉起 prisma 与 s3, 测试只覆盖 route 层校验, 掐断副作用导入
vi.mock('~/app/api/edit/create', () => ({ createGalgame: createGalgameMock }))
vi.mock('~/app/api/edit/update', () => ({ updateGalgame: updateGalgameMock }))

import { POST } from '../route'

const buildFormData = (overrides: Record<string, string> = {}) => {
  const formData = new FormData()
  formData.append(
    'banner',
    new File([new Uint8Array([1, 2, 3])], 'banner.avif')
  )
  formData.append('name', '测试 Galgame')
  formData.append('vndbId', '')
  formData.append('vndbRelationId', '')
  formData.append('bangumiId', '')
  formData.append('steamId', '')
  formData.append('dlsiteCode', '')
  formData.append('introduction', '这是一段足够长的游戏介绍文本')
  formData.append('alias', JSON.stringify([]))
  formData.append('tag', JSON.stringify(['标签一']))
  formData.append('released', '2026-01-01')
  formData.append('contentLimit', 'sfw')
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value)
  }
  return formData
}

const postRequest = (formData: FormData) =>
  new NextRequest('http://localhost/api/edit', {
    method: 'POST',
    body: formData
  })

beforeEach(() => {
  vi.resetAllMocks()
  verifyHeaderCookieMock.mockResolvedValue({ uid: 1, role: 4 })
  createGalgameMock.mockResolvedValue({ uniqueId: 'abcd1234' })
  updateGalgameMock.mockResolvedValue({})
})

// patch_tag.name 是 VarChar(107) 而 patch_alias.name 是 VarChar(1007)。标签超长
// 若放行, 会在 patch 主事务提交后的 batchTag 才抛 22001 冒泡成 500
describe('POST /api/edit 标签与别名的长度上限', () => {
  it('拒绝 108 字符标签且不触达 createGalgame', async () => {
    const res = await POST(
      postRequest(buildFormData({ tag: JSON.stringify(['x'.repeat(108)]) }))
    )

    expect(await res.json()).toBe('单个标签的长度不可超过 107 个字符')
    expect(createGalgameMock).not.toHaveBeenCalled()
  })

  it('放行 107 字符边界标签', async () => {
    const res = await POST(
      postRequest(buildFormData({ tag: JSON.stringify(['x'.repeat(107)]) }))
    )

    expect(await res.json()).toEqual({ uniqueId: 'abcd1234' })
    expect(createGalgameMock).toHaveBeenCalledTimes(1)
    expect(createGalgameMock.mock.calls[0][0].tag).toEqual(['x'.repeat(107)])
  })

  it('别名保持 500 上限不随标签一并收紧', async () => {
    const allowed = await POST(
      postRequest(buildFormData({ alias: JSON.stringify(['x'.repeat(500)]) }))
    )
    expect(await allowed.json()).toEqual({ uniqueId: 'abcd1234' })

    const rejected = await POST(
      postRequest(buildFormData({ alias: JSON.stringify(['x'.repeat(501)]) }))
    )
    expect(await rejected.json()).toBe('单个别名的长度不可超过 500 个字符')
  })
})
