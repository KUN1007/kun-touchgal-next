import { describe, expect, it, vi } from 'vitest'

const { findManyMock, markdownToHtmlMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  markdownToHtmlMock: vi.fn()
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch_resource: {
      findMany: findManyMock
    }
  }
}))

vi.mock('~/app/api/utils/render/markdownToHtml', () => ({
  markdownToHtml: markdownToHtmlMock
}))

import { getPatchResource } from '~/app/api/patch/resource/get'

describe('getPatchResource', () => {
  it('selects only the user fields exposed by the resource response', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 1,
        name: 'English patch',
        section: 'Patch files',
        patch: { unique_id: 'patch-123' },
        type: ['translation'],
        language: ['en'],
        note: 'Release notes',
        platform: ['windows'],
        links: [
          {
            id: 2,
            storage: 's3',
            size: '10 MB',
            code: 'download-code',
            password: 'download-password',
            hash: 'sha256',
            content: 'archive.zip',
            sort_order: 1,
            download: 5
          }
        ],
        _count: { like_by: 3 },
        like_by: [],
        status: 0,
        user_id: 7,
        patch_id: 123,
        created: new Date('2025-01-02T03:04:05.000Z'),
        user: {
          id: 7,
          name: 'Alice',
          avatar: 'alice.webp',
          role: 1,
          _count: { patch_resource: 4 }
        }
      }
    ])
    markdownToHtmlMock.mockResolvedValue('<p>Release notes</p>')

    const resources = await getPatchResource(
      { patchId: 123 },
      { uid: 7, role: 1 }
    )

    expect(resources[0]?.user).toStrictEqual({
      id: 7,
      name: 'Alice',
      avatar: 'alice.webp',
      patchCount: 4,
      role: 1
    })

    const userRelation = findManyMock.mock.calls[0]?.[0].include.user
    expect(userRelation).toStrictEqual({
      select: {
        id: true,
        name: true,
        avatar: true,
        role: true,
        _count: {
          select: { patch_resource: true }
        }
      }
    })
  })
})
