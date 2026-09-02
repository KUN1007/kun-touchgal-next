import { describe, expect, it } from 'vitest'
import { dropLoadedMessages } from '~/components/message/chat/dropLoadedMessages'
import type { PrivateMessage } from '~/types/api/conversation'

const msg = (id: number, content = `m${id}`): PrivateMessage => ({
  id,
  content,
  status: 0,
  isDeleted: false,
  editedAt: null,
  created: new Date(id * 1000).toISOString(),
  sender: { id: 1, name: 'a', avatar: '' }
})

describe('dropLoadedMessages', () => {
  it('offset 漂移导致下一页重叠上一页尾部时, 已加载的 id 被剔除', () => {
    const prev = [msg(30), msg(31), msg(32)]
    const incoming = [msg(30, 'server-copy'), msg(29), msg(28)]

    expect(dropLoadedMessages(prev, incoming).map((m) => m.id)).toEqual([
      29, 28
    ])
  })

  it('无重叠时全量保留并维持服务端顺序', () => {
    const prev = [msg(30), msg(31)]
    const incoming = [msg(29), msg(28), msg(27)]

    expect(dropLoadedMessages(prev, incoming)).toEqual(incoming)
  })
})
