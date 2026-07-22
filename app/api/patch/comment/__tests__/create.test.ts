import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createCommentMock,
  transactionMock,
  markdownToHtmlCommentMock,
  preScreenTextMock,
  createModerationTaskMock,
  createDedupMessageMock,
  createMentionMessageMock,
  invalidateContentMock
} = vi.hoisted(() => ({
  createCommentMock: vi.fn(),
  transactionMock: vi.fn(),
  markdownToHtmlCommentMock: vi.fn(),
  preScreenTextMock: vi.fn(),
  createModerationTaskMock: vi.fn(),
  createDedupMessageMock: vi.fn(),
  createMentionMessageMock: vi.fn(),
  invalidateContentMock: vi.fn(async () => undefined)
}))

const transactionClient = {
  patch_comment: {
    create: createCommentMock
  }
}

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_comment: { findUnique: vi.fn() },
    $transaction: transactionMock
  }
}))

vi.mock('~/app/api/utils/message', () => ({
  createDedupMessage: createDedupMessageMock
}))

vi.mock('~/app/api/utils/createMentionMessage', () => ({
  createMentionMessage: createMentionMessageMock
}))

vi.mock('~/app/api/utils/render/markdownToHtmlComment', () => ({
  COMMENT_HTML_VERSION: 1,
  markdownToHtmlComment: markdownToHtmlCommentMock
}))

vi.mock('~/server/moderation/submit', () => ({
  createModerationTask: createModerationTaskMock,
  preScreenText: preScreenTextMock
}))

vi.mock('~/app/api/patch/cache', () => ({
  invalidatePatchContentCache: invalidateContentMock
}))

import { createPatchComment } from '~/app/api/patch/comment/create'

const created = new Date('2026-01-01T00:00:00.000Z')
const comment = {
  id: 11,
  content: 'comment',
  is_spoiler: false,
  status: 0,
  user_id: 7,
  patch_id: 10,
  parent_id: null,
  created,
  updated: created,
  patch: { name: 'Patch', unique_id: 'patch-10' },
  user: { name: 'user' }
}
const input = {
  patchId: 10,
  parentId: null,
  content: 'comment',
  isSpoiler: false
}

beforeEach(() => {
  vi.clearAllMocks()
  createCommentMock.mockResolvedValue(comment)
  markdownToHtmlCommentMock.mockResolvedValue('<p>comment</p>')
  preScreenTextMock.mockResolvedValue({
    queue: false,
    intercept: false,
    dryRun: false
  })
  createModerationTaskMock.mockResolvedValue(undefined)
  createMentionMessageMock.mockResolvedValue(undefined)
  transactionMock.mockImplementation(
    async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient)
  )
})

describe('createPatchComment', () => {
  it('starts moderation pre-screening before Markdown rendering completes', async () => {
    let resolveRender: ((html: string) => void) | undefined
    markdownToHtmlCommentMock.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveRender = resolve
        })
    )

    const creation = createPatchComment(input, 7, 2)

    expect(preScreenTextMock).toHaveBeenCalledWith('comment', 2)
    expect(transactionMock).not.toHaveBeenCalled()

    resolveRender?.('<p>comment</p>')
    const result = await creation

    expect(createCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content_html: '<p>comment</p>',
          content_html_version: 1,
          status: 0
        })
      })
    )
    expect(result).toEqual(
      expect.objectContaining({ content: '<p>comment</p>', status: 0 })
    )
  })

  it('preserves the stored fallback when initial Markdown rendering fails', async () => {
    markdownToHtmlCommentMock
      .mockRejectedValueOnce(new Error('render failed'))
      .mockResolvedValueOnce('<p>retry</p>')

    const result = await createPatchComment(input, 7, 2)

    expect(createCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content_html: '',
          content_html_version: 0,
          status: 0
        })
      })
    )
    expect(result).toEqual(
      expect.objectContaining({ content: '<p>retry</p>', status: 0 })
    )
  })

  it('评论创建后按 unique_id 失效补丁详情缓存 (M-05)', async () => {
    await createPatchComment(input, 7, 2)

    expect(invalidateContentMock).toHaveBeenCalledWith('patch-10')
  })

  it('创建评论时把调用者角色透传给审核预筛', async () => {
    await createPatchComment(input, 7, 3)

    expect(preScreenTextMock).toHaveBeenCalledWith('comment', 3)
  })
})
