import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getModerationConfigMock } = vi.hoisted(() => ({
  getModerationConfigMock: vi.fn()
}))

vi.mock('~/prisma/index', () => ({ prisma: {} }))

vi.mock('~/server/moderation/config', () => ({
  getModerationConfig: getModerationConfigMock
}))

import {
  MODERATION_SKIP,
  preScreenMedia,
  preScreenText
} from '~/server/moderation/submit'

beforeEach(() => {
  vi.clearAllMocks()
  getModerationConfigMock.mockResolvedValue({ enabled: true, dryRun: false })
})

describe('审核预筛选角色豁免: 仅超级管理员 (role>=4) 跳过', () => {
  it('role 4 文本预筛直接放行, 不读审核配置', async () => {
    expect(await preScreenText('一段需要审核的正文内容', 4)).toBe(
      MODERATION_SKIP
    )
    expect(getModerationConfigMock).not.toHaveBeenCalled()
  })

  it('role 3 管理员不豁免, 文本正常送审并拦截', async () => {
    expect(await preScreenText('一段需要审核的正文内容', 3)).toEqual({
      queue: true,
      intercept: true,
      dryRun: false
    })
  })

  it('role 4 媒体预筛直接放行, 不读审核配置', async () => {
    expect(await preScreenMedia(4)).toBe(MODERATION_SKIP)
    expect(getModerationConfigMock).not.toHaveBeenCalled()
  })

  it('role 3 管理员媒体预筛正常送审', async () => {
    expect(await preScreenMedia(3)).toEqual({
      queue: true,
      intercept: true,
      dryRun: false
    })
  })

  it('审核开关关闭时任何角色都放行', async () => {
    getModerationConfigMock.mockResolvedValue({ enabled: false, dryRun: false })

    expect(await preScreenText('一段需要审核的正文内容', 1)).toBe(
      MODERATION_SKIP
    )
  })
})
