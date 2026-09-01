import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findManyMock, createManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  createManyMock: vi.fn()
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    user_message: { findMany: findManyMock, createMany: createManyMock }
  }
}))

import {
  createMentionMessage,
  extractMentionUserIds
} from '~/app/api/utils/createMentionMessage'

describe('extractMentionUserIds', () => {
  it('提取编辑器插入的 /comment 提及链接', () => {
    expect(extractMentionUserIds('召唤 [@kun](/user/3/comment) 看看')).toEqual([
      3
    ])
  })

  it('提取历史内容中的 /resource 提及链接', () => {
    expect(extractMentionUserIds('[@kun](/user/3/resource)')).toEqual([3])
  })

  it('同时提取混合格式的多个提及', () => {
    expect(
      extractMentionUserIds(
        '[@a](/user/1/comment) 和 [@b](/user/2/resource) 以及 [@c](/user/5/comment)'
      )
    ).toEqual([1, 2, 5])
  })

  it('忽略普通链接与非提及内容', () => {
    expect(
      extractMentionUserIds(
        '[@kun](/user/3/setting) [普通链接](/user/3/comment) @裸文本'
      )
    ).toEqual([])
  })
})

describe('createMentionMessage', () => {
  const callWith = (text: string) =>
    createMentionMessage('patch-10', '游戏名', 11, 7, 'kun', text, null)

  beforeEach(() => {
    vi.resetAllMocks()
    findManyMock.mockResolvedValue([])
    createManyMock.mockResolvedValue({ count: 0 })
  })

  it('同一评论重复提及同一用户只发一条通知', async () => {
    await callWith('[@a](/user/5/comment) 再喊一次 [@a](/user/5/comment)')

    expect(createManyMock).toHaveBeenCalledWith({
      data: [
        {
          type: 'mention',
          content: expect.stringContaining('kun 在「游戏名」的评论区提到了您'),
          sender_id: 7,
          recipient_id: 5,
          link: '/patch-10?tab=comments&commentId=11'
        }
      ]
    })
  })

  it('过滤自提及, 全部过滤后不发起查询与写入', async () => {
    await callWith('[@me](/user/7/comment)')

    expect(findManyMock).not.toHaveBeenCalled()
    expect(createManyMock).not.toHaveBeenCalled()
  })

  it('去重键 (type, sender, recipient, link): 已通知的跳过, 新提及正常创建', async () => {
    findManyMock.mockResolvedValue([{ recipient_id: 3 }])

    await callWith('[@a](/user/3/comment) [@b](/user/5/comment)')

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        type: 'mention',
        sender_id: 7,
        recipient_id: { in: [3, 5] },
        link: '/patch-10?tab=comments&commentId=11'
      },
      select: { recipient_id: true }
    })
    expect(createManyMock).toHaveBeenCalledWith({
      data: [expect.objectContaining({ recipient_id: 5 })]
    })
  })

  it('全部提及均已通知时不再写入', async () => {
    findManyMock.mockResolvedValue([{ recipient_id: 3 }])

    await callWith('[@a](/user/3/comment)')

    expect(createManyMock).not.toHaveBeenCalled()
  })
})
