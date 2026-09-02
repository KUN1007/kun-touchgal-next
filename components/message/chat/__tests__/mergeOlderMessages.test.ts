import { describe, expect, it } from 'vitest'
import { mergeOlderMessages } from '~/components/message/chat/mergeOlderMessages'
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

describe('mergeOlderMessages', () => {
  it('offset 漂移导致下一页重叠上一页尾部时, 已加载的 id 被剔除且本地版本保留', () => {
    const prev = [msg(30), msg(31), msg(32)]
    const incoming = [msg(30, 'server-copy'), msg(29), msg(28)]

    const older = mergeOlderMessages(prev, incoming)

    expect(older.map((m) => m.id)).toEqual([29, 28])
    expect(prev.find((m) => m.id === 30)?.content).toBe('m30')
  })

  it('无重叠时全量保留并维持服务端顺序', () => {
    const prev = [msg(30), msg(31)]
    const incoming = [msg(29), msg(28), msg(27)]

    expect(mergeOlderMessages(prev, incoming)).toEqual(incoming)
  })
})
