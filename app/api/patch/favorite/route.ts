import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePutBody } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
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
  const [patch, folder, existing] = await Promise.all([
    prisma.patch.findUnique({
      where: { id: input.patchId },
      select: { user_id: true, name: true, unique_id: true }
    }),
    prisma.user_patch_favorite_folder.findUnique({
      where: { id: input.folderId },
      select: { user_id: true }
    }),
    prisma.user_patch_favorite_folder_relation.findUnique({
      where: {
        folder_id_patch_id: {
          folder_id: input.folderId,
          patch_id: input.patchId
        }
      },
      select: { folder_id: true }
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

  const response = await prisma.$transaction(async (prisma) => {
    if (patch.user_id !== uid) {
      await createDedupMessage({
        type: 'favorite',
        content: patch.name,
        sender_id: uid,
        recipient_id: patch.user_id,
        link: `/${patch.unique_id}`
      })
    }

    if (existing) {
      await prisma.user_patch_favorite_folder_relation.delete({
        where: {
          folder_id_patch_id: {
            folder_id: input.folderId,
            patch_id: input.patchId
          }
        }
      })
      return { added: false }
    } else {
      await prisma.user_patch_favorite_folder_relation.create({
        data: {
          folder_id: input.folderId,
          patch_id: input.patchId
        }
      })
      return { added: true }
    }
  })

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
