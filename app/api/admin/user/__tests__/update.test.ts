import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reservedUsernameMessage } from '~/constants/reserved-usernames.server'

const {
  findUserMock,
  transactionMock,
  updateUserMock,
  createLogMock,
  deleteTokenMock,
  hashPasswordMock
} = vi.hoisted(() => ({
  findUserMock: vi.fn(),
  transactionMock: vi.fn(),
  updateUserMock: vi.fn(),
  createLogMock: vi.fn(),
  deleteTokenMock: vi.fn(),
  hashPasswordMock: vi.fn()
}))

const transactionClient = {
  user: { update: updateUserMock },
  admin_log: { create: createLogMock }
}

vi.mock('~/prisma/index', () => ({
  prisma: {
    user: { findUnique: findUserMock },
    $transaction: transactionMock
  }
}))

vi.mock('~/app/api/utils/jwt', () => ({
  deleteKunToken: deleteTokenMock
}))

vi.mock('~/app/api/utils/algorithm', () => ({
  hashPassword: hashPasswordMock
}))

import { updateUser } from '~/app/api/admin/user/update'

// 库里存量的保留名用户: uid 1 (超管本人) 与冒名的 admin 都属于这一类
const reservedNameUser = {
  id: 7,
  daily_image_count: 10,
  moemoepoint: 100,
  name: 'admin',
  email: 'target@example.com',
  bio: '',
  role: 1,
  status: 0
}

const baseInput = {
  uid: 7,
  name: 'admin',
  email: 'target@example.com',
  role: 1,
  status: 0,
  dailyImageCount: 10,
  moemoepoint: 100,
  bio: ''
}

beforeEach(() => {
  vi.clearAllMocks()
  findUserMock
    .mockResolvedValueOnce(reservedNameUser)
    .mockResolvedValueOnce({ role: 4, name: 'root-admin' })
  updateUserMock.mockResolvedValue({})
  createLogMock.mockResolvedValue({})
  deleteTokenMock.mockResolvedValue(undefined)
  transactionMock.mockImplementation(
    async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient)
  )
})

describe('updateUser 保留用户名', () => {
  it('不改名时放行存量保留名用户的封禁与改权', async () => {
    await expect(
      updateUser({ ...baseInput, role: 2, status: 1 }, 99)
    ).resolves.toEqual({})

    // 只查目标用户与管理员两次, 不进重名查询分支
    expect(findUserMock).toHaveBeenCalledTimes(2)
    expect(updateUserMock).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        daily_image_count: 10,
        name: 'admin',
        email: 'target@example.com',
        role: 2,
        status: 1,
        moemoepoint: 100,
        bio: ''
      }
    })
    expect(deleteTokenMock).toHaveBeenCalledWith(7)
  })

  it('拒绝把用户改名为保留词, 不落库', async () => {
    findUserMock.mockReset()
    findUserMock
      .mockResolvedValueOnce({ ...reservedNameUser, name: 'kun' })
      .mockResolvedValueOnce({ role: 4, name: 'root-admin' })

    await expect(
      updateUser({ ...baseInput, name: 'Official' }, 99)
    ).resolves.toBe(reservedUsernameMessage)

    // 保留词在重名查询之前拦下, 不多打一次库
    expect(findUserMock).toHaveBeenCalledTimes(2)
    expect(transactionMock).not.toHaveBeenCalled()
    expect(deleteTokenMock).not.toHaveBeenCalled()
  })

  it('允许把存量保留名用户改成非保留名', async () => {
    findUserMock.mockResolvedValueOnce(null)

    await expect(
      updateUser({ ...baseInput, name: 'kun-admin' }, 99)
    ).resolves.toEqual({})

    expect(findUserMock).toHaveBeenNthCalledWith(3, {
      where: { name: 'kun-admin' },
      select: { id: true }
    })
    expect(updateUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'kun-admin' })
      })
    )
  })
})
