import { prisma } from '~/prisma/index'

export const getApplyStatus = async (uid: number) => {
  const [count, user] = await Promise.all([
    prisma.patch_resource.count({
      where: { user_id: uid }
    }),
    prisma.user.findUnique({
      where: { id: uid },
      select: { role: true }
    })
  ])
  const role = user?.role ?? 0

  return { count, role }
}
