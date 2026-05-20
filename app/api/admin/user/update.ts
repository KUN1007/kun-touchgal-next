import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { adminUpdateUserSchema } from '~/validations/admin'
import { deleteKunToken } from '~/app/api/utils/jwt'
import { hashPassword } from '~/app/api/utils/algorithm'

export const updateUser = async (
  input: z.infer<typeof adminUpdateUserSchema>,
  adminUid: number
) => {
  const { uid, dailyImageCount, password, ...rest } = input

  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: {
      id: true,
      daily_image_count: true,
      name: true,
      email: true,
      bio: true,
      role: true,
      status: true
    }
  })
  if (!user) {
    return '未找到该用户'
  }

  const admin = await prisma.user.findUnique({
    where: { id: adminUid }
  })
  if (!admin) {
    return '未找到该管理员'
  }
  if (rest.role >= 3 && admin.role < 4) {
    return '设置用户为管理员仅限超级管理员可用'
  }
  if (rest.name !== user.name) {
    const existingUserByName = await prisma.user.findUnique({
      where: { name: rest.name },
      select: { id: true }
    })
    if (existingUserByName) {
      return '该用户名已被其他用户使用'
    }
  }
  if (rest.email !== user.email) {
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: rest.email },
      select: { id: true }
    })
    if (existingUserByEmail) {
      return '该邮箱已被其他用户使用'
    }
  }

  const hashedPassword = password ? await hashPassword(password) : undefined
  const logInput = {
    ...input,
    ...(password ? { password: '[REDACTED]' } : {})
  }

  const result = await prisma.$transaction(async (prisma) => {
    await prisma.user.update({
      where: { id: uid },
      data: {
        daily_image_count: dailyImageCount,
        ...rest,
        ...(hashedPassword ? { password: hashedPassword } : {})
      }
    })

    await prisma.admin_log.create({
      data: {
        type: 'update',
        user_id: adminUid,
        content: `管理员 ${admin.name} 更改了一个用户的信息\n\n更改内容:\n${JSON.stringify(logInput)}\n\n原用户信息:\n${JSON.stringify(user)}`
      }
    })

    return {}
  })

  await deleteKunToken(uid)
  return result
}
