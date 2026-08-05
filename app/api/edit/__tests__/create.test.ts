import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { Prisma } from '~/prisma/generated/prisma/client'

const {
  uploadImageToS3Mock,
  patchFindFirstMock,
  transactionMock,
  patchCreateMock,
  patchUpdateMock,
  ratingStatCreateMock,
  aliasCreateManyMock,
  userUpdateMock,
  enqueueSearchOutboxMock,
  queueSearchSyncMock,
  invalidateUserSessionMock,
  processSubmittedExternalDataMock,
  postToIndexNowMock
} = vi.hoisted(() => ({
  uploadImageToS3Mock: vi.fn(),
  patchFindFirstMock: vi.fn(),
  transactionMock: vi.fn(),
  patchCreateMock: vi.fn(),
  patchUpdateMock: vi.fn(),
  ratingStatCreateMock: vi.fn(),
  aliasCreateManyMock: vi.fn(),
  userUpdateMock: vi.fn(),
  enqueueSearchOutboxMock: vi.fn(),
  queueSearchSyncMock: vi.fn(),
  invalidateUserSessionMock: vi.fn(),
  processSubmittedExternalDataMock: vi.fn(),
  postToIndexNowMock: vi.fn()
}))

const transactionClient = {
  patch: { create: patchCreateMock, update: patchUpdateMock },
  patch_rating_stat: { create: ratingStatCreateMock },
  patch_alias: { createMany: aliasCreateManyMock },
  user: { update: userUpdateMock }
}

vi.mock('~/lib/s3', () => ({
  uploadImageToS3: uploadImageToS3Mock
}))

vi.mock('~/prisma/index', () => ({
  prisma: {
    patch: { findFirst: patchFindFirstMock },
    $transaction: transactionMock
  }
}))

vi.mock('~/server/search/sync', () => ({
  enqueueSearchOutbox: enqueueSearchOutboxMock,
  queueSearchSync: queueSearchSyncMock
}))

vi.mock('~/app/api/user/session/cache', () => ({
  invalidateUserSession: invalidateUserSessionMock
}))

vi.mock('~/app/api/edit/processExternalData', () => ({
  processSubmittedExternalData: processSubmittedExternalDataMock
}))

vi.mock('~/app/api/edit/_postToIndexNow', () => ({
  postToIndexNow: postToIndexNowMock
}))

import { createGalgame } from '../create'

const createPng = async (
  width: number,
  height: number
): Promise<ArrayBuffer> => {
  const buf = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 100, g: 150, b: 200 }
    }
  })
    .png()
    .toBuffer()
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  ) as ArrayBuffer
}

const makeInput = (banner: ArrayBuffer) => ({
  name: '测试 Galgame',
  vndbId: '',
  vndbRelationId: '',
  bangumiId: '',
  steamId: '',
  dlsiteCode: '',
  dlsiteCircleName: '',
  dlsiteCircleLink: '',
  vndbTags: [],
  vndbDevelopers: [],
  bangumiTags: [],
  bangumiDevelopers: [],
  steamTags: [],
  steamDevelopers: [],
  steamAliases: [],
  alias: ['别名一'],
  tag: ['标签一'],
  banner,
  introduction: '这是一段足够长的游戏介绍文本',
  released: '2026-01-01',
  contentLimit: 'nsfw'
})

// 忠实模拟 Prisma 交互式事务的提交语义: 回调 resolve 即提交(哪怕 resolve 的是表示
// 业务错误的字符串), 只有抛出才回滚. 断言 committed 才能区分"回滚"与"提交了半成品",
// 只断言返回值的话两者长得一模一样 —— 而那正是本文件守护的缺陷类
let committed = false

describe('createGalgame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    committed = false
    uploadImageToS3Mock.mockResolvedValue(undefined)
    patchFindFirstMock.mockResolvedValue(null)
    patchCreateMock.mockResolvedValue({ id: 42 })
    transactionMock.mockImplementation(
      async (callback: (tx: typeof transactionClient) => unknown) => {
        const result = await callback(transactionClient)
        committed = true
        return result
      }
    )
  })

  it('banner 编码失败时不开启事务, 不留下半成品 patch 行', async () => {
    const bomb = await createPng(8000, 7000) // 56M > 50M 像素上限

    const res = await createGalgame(makeInput(bomb), 1)

    expect(res).toBe('图片尺寸过大')
    expect(transactionMock).not.toHaveBeenCalled()
    expect(patchCreateMock).not.toHaveBeenCalled()
    expect(uploadImageToS3Mock).not.toHaveBeenCalled()
  }, 30000)

  it('S3 上传失败时抛出而非返回, 使事务回滚', async () => {
    const image = await createPng(400, 300)
    uploadImageToS3Mock.mockRejectedValue(new Error('S3 down'))

    await expect(createGalgame(makeInput(image), 1)).rejects.toThrow('S3 down')
    expect(committed).toBe(false)
    expect(patchUpdateMock).not.toHaveBeenCalled()
    expect(enqueueSearchOutboxMock).not.toHaveBeenCalled()
  }, 30000)

  it('bangumi_id 预检命中时返回重复提示, 不开启事务', async () => {
    const image = await createPng(400, 300)
    patchFindFirstMock.mockResolvedValue({ unique_id: 'deadbeef' })

    const res = await createGalgame(
      { ...makeInput(image), bangumiId: '123456' },
      1
    )

    expect(res).toBe('Galgame Bangumi ID 与游戏 ID 为 deadbeef 的游戏重复')
    expect(patchFindFirstMock).toHaveBeenCalledWith({
      where: { bangumi_id: 123456 },
      select: { unique_id: true }
    })
    expect(transactionMock).not.toHaveBeenCalled()
  }, 30000)

  it('预检与 create 之间的并发窗口撞唯一索引时翻成字符串而非 500', async () => {
    const image = await createPng(400, 300)
    patchCreateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique constraint', {
        code: 'P2002',
        clientVersion: 'test'
      })
    )

    const res = await createGalgame(
      { ...makeInput(image), steamId: '654321' },
      1
    )

    expect(res).toBe('您填写的外部 ID 已经被其它 Galgame 使用, 请检查后重试')
    expect(committed).toBe(false)
    expect(invalidateUserSessionMock).not.toHaveBeenCalled()
    expect(queueSearchSyncMock).not.toHaveBeenCalled()
  }, 30000)

  it('非 P2002 的错误继续抛出', async () => {
    const image = await createPng(400, 300)
    patchCreateMock.mockRejectedValue(new Error('connection lost'))

    await expect(createGalgame(makeInput(image), 1)).rejects.toThrow(
      'connection lost'
    )
  }, 30000)

  it('正常图片走完整条创建链路', async () => {
    const image = await createPng(400, 300)

    const res = await createGalgame(makeInput(image), 1)

    expect(typeof res).toBe('object')
    expect(committed).toBe(true)
    expect(patchCreateMock).toHaveBeenCalledTimes(1)
    expect(uploadImageToS3Mock).toHaveBeenCalledTimes(2)
    expect(patchUpdateMock).toHaveBeenCalledTimes(1)
    expect(ratingStatCreateMock).toHaveBeenCalledTimes(1)
    expect(aliasCreateManyMock).toHaveBeenCalledTimes(1)
    expect(userUpdateMock).toHaveBeenCalledTimes(1)
    expect(enqueueSearchOutboxMock).toHaveBeenCalledWith(transactionClient, 42)
    expect(invalidateUserSessionMock).toHaveBeenCalledWith(1)
    expect(processSubmittedExternalDataMock).toHaveBeenCalledTimes(1)
    expect(queueSearchSyncMock).toHaveBeenCalledWith(42)
  }, 30000)
})
