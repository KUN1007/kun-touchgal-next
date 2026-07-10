import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { getTagSchema } from '~/validations/tag'

export const getTag = async (
  input: z.infer<typeof getTagSchema>,
  blockedTagIds: number[] = []
) => {
  const { page, limit } = input
  const offset = (page - 1) * limit
  const where = blockedTagIds.length
    ? { id: { notIn: blockedTagIds } }
    : undefined

  const [data, total] = await Promise.all([
    prisma.patch_tag.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { count: 'desc' },
      select: {
        id: true,
        name: true,
        count: true,
        alias: true
      }
    }),
    prisma.patch_tag.count({ where })
  ])

  return { tags: data, total }
}
