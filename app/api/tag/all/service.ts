import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { getTagSchema } from '~/validations/tag'
import { getCachedTagList, getTagListCacheKey, setTagListCache } from '../cache'

export const getTag = async (
  input: z.infer<typeof getTagSchema>,
  blockedTagIds: number[] = []
) => {
  const { page, limit } = input
  const cacheKey = await getTagListCacheKey(input, blockedTagIds)
  const cached = await getCachedTagList(cacheKey)
  if (cached.response) {
    return cached.response
  }

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

  const response = { tags: data, total }
  if (cacheKey && cached.canWrite) {
    await setTagListCache(cacheKey, response)
  }

  return response
}
