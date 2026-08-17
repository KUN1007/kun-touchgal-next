import { describe, expect, it } from 'vitest'
import {
  ADMIN_COMMENT_DELETE_LIMIT,
  ADMIN_RATING_DELETE_LIMIT
} from '~/constants/admin'
import {
  adminDeleteCommentSchema,
  adminDeleteRatingSchema
} from '~/validations/admin'

const buildIds = (count: number) =>
  Array.from({ length: count }, (_, i) => String(i + 1)).join(',')

describe('adminDeleteCommentSchema 批量删除上限', () => {
  it('前端分块大小 (整块 ADMIN_COMMENT_DELETE_LIMIT 条) 通过校验', () => {
    const result = adminDeleteCommentSchema.safeParse({
      commentIds: buildIds(ADMIN_COMMENT_DELETE_LIMIT)
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.commentIds).toHaveLength(ADMIN_COMMENT_DELETE_LIMIT)
    }
  })

  it('回归: 31 条 (旧上限 30 的越界点) 通过校验', () => {
    const result = adminDeleteCommentSchema.safeParse({
      commentIds: buildIds(31)
    })
    expect(result.success).toBe(true)
  })

  it('超过上限被拒绝', () => {
    const result = adminDeleteCommentSchema.safeParse({
      commentIds: buildIds(ADMIN_COMMENT_DELETE_LIMIT + 1)
    })
    expect(result.success).toBe(false)
  })

  it('单条 commentId 分支仍可用', () => {
    const result = adminDeleteCommentSchema.safeParse({ commentId: '7' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.commentIds).toEqual([7])
    }
  })
})

describe('adminDeleteRatingSchema 批量删除上限', () => {
  it('前端分块大小 (整块 ADMIN_RATING_DELETE_LIMIT 条) 通过校验', () => {
    const result = adminDeleteRatingSchema.safeParse({
      ratingIds: buildIds(ADMIN_RATING_DELETE_LIMIT)
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ratingIds).toHaveLength(ADMIN_RATING_DELETE_LIMIT)
    }
  })

  it('回归: 31 条 (旧上限 30 的越界点) 通过校验', () => {
    const result = adminDeleteRatingSchema.safeParse({
      ratingIds: buildIds(31)
    })
    expect(result.success).toBe(true)
  })

  it('超过上限被拒绝', () => {
    const result = adminDeleteRatingSchema.safeParse({
      ratingIds: buildIds(ADMIN_RATING_DELETE_LIMIT + 1)
    })
    expect(result.success).toBe(false)
  })

  it('单条 ratingId 分支仍可用', () => {
    const result = adminDeleteRatingSchema.safeParse({ ratingId: '7' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ratingIds).toEqual([7])
    }
  })
})
