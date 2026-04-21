import { z } from 'zod'
import { prisma } from '~/prisma/index'
import type { UserInfo } from '~/types/api/user'

const getProfileSchema = z.object({
  id: z.coerce.number().min(1).max(9999999)
})

export const getUserProfile = async (
  input: z.infer<typeof getProfileSchema>,
  currentUserUid: number
) => {
  const data = await prisma.user.findUnique({
    where: { id: input.id },
    include: {
      _count: {
        select: {
          patch_resource: true,
          patch: true,
          patch_comment: true,
          patch_rating: true
        }
      },
      follower: true,
      following: true
    }
  })
  const userFavoritePatchCount =
    await prisma.user_patch_favorite_folder_relation.count({
      where: { folder: { user_id: input.id } }
    })
  if (!data) {
    return '未找到用户'
  }

  const followerUserUid = data.following.map((f) => f.follower_id)
  const isSelf = currentUserUid === input.id

  const user: UserInfo = {
    id: data.id,
    requestUserUid: currentUserUid,
    name: data.name,
    email: isSelf ? data.email : '',
    avatar: data.avatar,
    bio: data.bio,
    role: data.role,
    status: data.status,
    registerTime: String(data.register_time),
    moemoepoint: data.moemoepoint,
    follower: data.following.length,
    following: data.follower.length,
    isFollow: followerUserUid.includes(currentUserUid),
    _count: {
      ...data._count,
      patch_favorite: userFavoritePatchCount
    }
  }

  return user
}
