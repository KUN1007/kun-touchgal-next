import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParseGetQuery } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { getUserFollowStatusSchema } from '~/validations/user'
import type { UserFollow } from '~/types/api/user'

export const getUserFollowing = async (
  input: z.infer<typeof getUserFollowStatusSchema>,
  currentUserUid: number | undefined
) => {
  const { uid, page, limit } = input
  const offset = (page - 1) * limit

  const [data, total] = await Promise.all([
    prisma.user_follow_relation.findMany({
      take: limit,
      skip: offset,
      where: { follower_id: uid },
      include: {
        following: {
          include: {
            follower: true,
            following: true
          }
        }
      }
    }),
    prisma.user_follow_relation.count({
      where: { follower_id: uid }
    })
  ])

  const followings: UserFollow[] = data.map((r) => ({
    id: r.following.id,
    name: r.following.name,
    avatar: r.following.avatar,
    bio: r.following.bio,
    follower: r.following.following.length,
    following: r.following.follower.length,
    isFollow: r.following.following
      .map((u) => u.follower_id)
      .includes(currentUserUid ?? 0)
  }))

  return { followings, total }
}

export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, getUserFollowStatusSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)

  const response = await getUserFollowing(input, payload?.uid)
  return NextResponse.json(response)
}
