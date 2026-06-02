import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePutBody } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { createDedupMessage } from '~/app/api/utils/message'
import { invalidateResourceStatsListCache } from '~/app/api/resource/cache'
import { invalidateUserSession } from '~/app/api/user/session/cache'

const resourceIdSchema = z.object({
  resourceId: z.coerce
    .number({ message: '资源 ID 必须为数字' })
    .min(1)
    .max(9999999)
})

const toggleResourceLike = async (
  input: z.infer<typeof resourceIdSchema>,
  uid: number
) => {
  const { resourceId } = input

  const resource = await prisma.patch_resource.findUnique({
    where: { id: resourceId },
    include: {
      patch: true
    }
  })
  if (!resource) {
    return '未找到资源'
  }
  if (resource.user_id === uid) {
    return '您不能给自己点赞'
  }

  const existingLike =
    await prisma.user_patch_resource_like_relation.findUnique({
      where: {
        user_id_resource_id: {
          user_id: uid,
          resource_id: resourceId
        }
      }
    })

  const response = await prisma.$transaction(async (tx) => {
    if (existingLike) {
      await tx.user_patch_resource_like_relation.delete({
        where: {
          user_id_resource_id: {
            user_id: uid,
            resource_id: resourceId
          }
        }
      })
    } else {
      await tx.user_patch_resource_like_relation.create({
        data: {
          user_id: uid,
          resource_id: resourceId
        }
      })
    }

    await tx.user.update({
      where: { id: resource.user_id },
      data: { moemoepoint: { increment: existingLike ? -1 : 1 } }
    })

    await createDedupMessage(
      {
        type: 'like',
        content: `赞了您在「${resource.patch.name}」下发布的资源`,
        sender_id: uid,
        recipient_id: resource.user_id,
        link: `/${resource.patch.unique_id}?tab=resources&resourceSection=${resource.section}&resourceId=${resource.id}`
      },
      tx
    )

    return !existingLike
  })

  await invalidateUserSession(resource.user_id)
  await invalidateResourceStatsListCache()
  return response
}

export const PUT = async (req: NextRequest) => {
  const input = await kunParsePutBody(req, resourceIdSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const response = await toggleResourceLike(input, payload.uid)
  return NextResponse.json(response)
}
