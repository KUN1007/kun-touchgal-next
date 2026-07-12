import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { updateTagSchema } from '~/validations/tag'
import { invalidateTagListCache } from './cache'
import type { TagDetail } from '~/types/api/tag'

export const updateTag = async (input: z.infer<typeof updateTagSchema>) => {
  const { tagId, name, introduction = '', alias = [] } = input

  const existingTag = await prisma.patch_tag.findFirst({
    where: {
      OR: [{ name }, { alias: { has: name } }]
    }
  })
  if (existingTag && existingTag.id !== tagId) {
    return '这个标签已经存在了'
  }

  const newTag: TagDetail = await prisma.patch_tag.update({
    where: { id: tagId },
    data: {
      name,
      introduction,
      alias
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatar: true
        }
      }
    }
  })
  await invalidateTagListCache()

  return newTag
}
