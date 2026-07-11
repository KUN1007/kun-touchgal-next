import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePutBody } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { Prisma } from '~/prisma/generated/prisma/client'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { togglePatchFavoriteSchema } from '~/validations/patch'
import { createDedupMessage } from '~/app/api/utils/message'
import {
  invalidatePatchFavoriteCache,
  invalidatePatchContentCache
} from '../cache'

const togglePatchFavorite = async (
  input: z.infer<typeof togglePatchFavoriteSchema>,
  uid: number
) => {
  const [patch, folder] = await Promise.all([
    prisma.patch.findUnique({
      where: { id: input.patchId },
      select: { user_id: true, name: true, unique_id: true }
    }),
    prisma.user_patch_favorite_folder.findUnique({
      where: { id: input.folderId },
      select: { user_id: true }
    })
  ])
  if (!patch) {
    return '未找到 Galgame'
  }
  if (!folder) {
    return '未找到收藏文件夹'
  }
  if (folder.user_id !== uid) {
    return '这不是您的收藏夹'
  }

  const messageData = {
    type: 'favorite' as const,
    content: patch.name,
    sender_id: uid,
    recipient_id: patch.user_id,
    link: `/${patch.unique_id}`
  }

  // deleteMany + createMany(skipDuplicates) 使并发双击不会触发 P2002/P2025
  const response = await prisma
    .$transaction(async (tx) => {
      const removed = await tx.user_patch_favorite_folder_relation.deleteMany({
        where: {
          folder_id: input.folderId,
          patch_id: input.patchId
        }
      })
      if (removed.count > 0) {
        if (patch.user_id !== uid) {
          await tx.user_message.deleteMany({
            where: {
              type: 'favorite',
              sender_id: uid,
              recipient_id: patch.user_id,
              link: messageData.link
            }
          })
        }
        return { added: false }
      }

      await tx.user_patch_favorite_folder_relation.createMany({
        data: {
          folder_id: input.folderId,
          patch_id: input.patchId
        },
        skipDuplicates: true
      })
      if (patch.user_id !== uid) {
        await createDedupMessage(messageData, tx)
      }
      return { added: true }
    })
    .catch((error: unknown) => {
      // 事务内任一外键的引用行被并发删除都会命中约束, 无法区分是哪一条, 返回通用文案
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        return '收藏失败, 请重试'
      }
      throw error
    })
  if (typeof response === 'string') {
    return response
  }

  try {
    await Promise.all([
      invalidatePatchFavoriteCache(patch.unique_id, uid),
      invalidatePatchContentCache(patch.unique_id)
    ])
  } catch {
    // 缓存失效失败不影响收藏结果
  }

  return response
}

export const PUT = async (req: NextRequest) => {
  const input = await kunParsePutBody(req, togglePatchFavoriteSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const response = await togglePatchFavorite(input, payload.uid)
  return NextResponse.json(response)
}
