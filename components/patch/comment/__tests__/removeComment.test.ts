import { describe, expect, it } from 'vitest'
import { removeComment } from '~/components/patch/comment/removeComment'
import type { PatchComment } from '~/types/api/patch'

const comment = (
  id: number,
  parentId: number | null,
  replyToId?: number | null
): PatchComment => ({
  id,
  uniqueId: 'p',
  content: `c${id}`,
  isLike: false,
  isSpoiler: false,
  status: 0,
  likeCount: 0,
  parentId,
  ...(replyToId === undefined ? {} : { replyToId }),
  userId: 1,
  patchId: 1,
  created: '',
  updated: '',
  reply: [],
  user: { id: 1, name: 'a', avatar: '' }
})

const root = (id: number, reply: PatchComment[] = []) => ({
  ...comment(id, null, null),
  reply
})

describe('removeComment', () => {
  it('删根评论: 从顶层移除', () => {
    const prev = [root(1, [comment(11, 1, 1)]), root(2)]

    expect(removeComment(prev, 1).map((c) => c.id)).toEqual([2])
  })

  it('删回复: 从父评论 reply 中移除, 其他根评论引用不变', () => {
    const prev = [root(1, [comment(11, 1, 1), comment(12, 1, 1)]), root(2)]

    const next = removeComment(prev, 11)

    expect(next.map((c) => c.id)).toEqual([1, 2])
    expect(next[0].reply.map((r) => r.id)).toEqual([12])
    expect(next[1]).toBe(prev[1])
  })

  it('删被回复过的回复: 按 replyToId 闭包剔除子回复, 不依赖数组顺序', () => {
    const prev = [
      root(1, [
        comment(13, 1, 12),
        comment(14, 1, 1),
        comment(12, 1, 11),
        comment(11, 1, 1)
      ])
    ]

    expect(removeComment(prev, 11)[0].reply.map((r) => r.id)).toEqual([14])
  })

  it('旧缓存页面缺 replyToId: 退化为只剔除自身', () => {
    const prev = [root(1, [comment(11, 1), comment(12, 1)])]

    expect(removeComment(prev, 11)[0].reply.map((r) => r.id)).toEqual([12])
  })

  it('id 不存在: 原样返回', () => {
    const prev = [root(1, [comment(11, 1, 1)]), root(2)]

    expect(removeComment(prev, 99)).toEqual(prev)
  })
})
