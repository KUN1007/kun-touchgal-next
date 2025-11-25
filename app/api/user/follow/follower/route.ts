import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParseGetQuery } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { getUserFollowStatusSchema } from '~/validations/user'
import type { UserFollow } from '~/types/api/user'

export const getUserFollower = async (
  input: z.infer<typeof getUserFollowStatusSchema>,
  currentUserUid: number | undefined
) => {
  const { uid, page, limit } = input
  const offset = (page - 1) * limit

  const [data, total] = await Promise.all([
    prisma.user_follow_relation.findMany({
      take: limit,
      skip: offset,
      where: { following_id: uid },
      include: {
        follower: {
          include: {
            follower: true,
            following: true
          }
        }
      }
    }),
    prisma.user_follow_relation.count({
      where: { following_id: uid }
    })
  ])

  const followers: UserFollow[] = data.map((r) => ({
    id: r.follower.id,
    name: r.follower.name,
    avatar: r.follower.avatar,
    bio: r.follower.bio,
    follower: r.follower.following.length,
    following: r.follower.follower.length,
    isFollow: r.follower.following
      .map((u) => u.follower_id)
      .includes(currentUserUid ?? 0)
  }))

  return { followers, total }
}

export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, getUserFollowStatusSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)

  const response = await getUserFollower(input, payload?.uid)
  return NextResponse.json(response)
}
