import { beforeEach, describe, expect, it, vi } from 'vitest'

const { hdelMock } = vi.hoisted(() => ({ hdelMock: vi.fn() }))

vi.mock('~/lib/redis', () => ({
  redis: { hdel: hdelMock },
  runRedisCommand: (command: () => Promise<unknown>) => command()
}))

import { acknowledgePatchViewBufferEntries } from '~/app/api/patch/views/buffer'

const PENDING = 'kun:touchgal:views:buffer:pending'

describe('acknowledgePatchViewBufferEntries 按字段 ack', () => {
  beforeEach(() => {
    hdelMock.mockReset().mockResolvedValue(1)
  })

  it('非 pending key 抛错且不发命令（防误删错 key）', async () => {
    await expect(
      acknowledgePatchViewBufferEntries('kun:touchgal:views:buffer', ['a'])
    ).rejects.toThrow('Invalid patch view buffer pending key')
    expect(hdelMock).not.toHaveBeenCalled()
  })

  it('空 uniqueIds 早返回，不发 HDEL（避免 ioredis 空字段报错）', async () => {
    await acknowledgePatchViewBufferEntries(PENDING, [])
    expect(hdelMock).not.toHaveBeenCalled()
  })

  it('正常按字段 HDEL 摘除本批', async () => {
    await acknowledgePatchViewBufferEntries(PENDING, ['a', 'b', 'c'])
    expect(hdelMock).toHaveBeenCalledWith(PENDING, 'a', 'b', 'c')
  })
})
