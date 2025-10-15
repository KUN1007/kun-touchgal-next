import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { deleteResource } from '../resource/delete'

const userIdSchema = z.object({
  uid: z.coerce.number({ message: '用户 ID 必须为数字' }).min(1).max(9999999)
})

export const deleteUser = async (
  input: z.infer<typeof userIdSchema>,
  uid: number
) => {
  const user = await prisma.user.findUnique({
    where: { id: input.uid }
  })
  if (!user) {
    return '未找到用户'
  }
  if (input.uid === uid) {
    return '请勿删除自己'
  }

  const admin = await prisma.user.findUnique({
    where: { id: uid }
  })
  if (!admin) {
    return '未找到管理员'
  }

  const patchResourceS3Ids = await prisma.patch_resource.findMany({
    where: { user_id: input.uid, storage: 's3' },
    select: { id: true }
  })
  const resourceIds = patchResourceS3Ids.map((s) => s.id)

  return prisma.$transaction(
    async (prisma) => {
      if (resourceIds.length) {
        for (const res of resourceIds) {
          await deleteResource({ resourceId: res }, uid)
        }
      }

      await prisma.user.delete({
        where: { id: input.uid }
      })

      await prisma.admin_log.create({
        data: {
          type: 'delete',
          user_id: uid,
          content: `管理员 ${admin.name} 删除了一个用户\n\n${JSON.stringify(user)}`
        }
      })

      return {}
    },
    { timeout: 60000 }
  )
}
