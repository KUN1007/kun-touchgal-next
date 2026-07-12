import { prisma } from '~/prisma/index'
import { invalidateTagListCache } from './cache'

export const deleteTag = async (tagId: number) => {
  const tag = await prisma.patch_tag.findUnique({
    where: { id: tagId }
  })
  if (!tag) {
    return '未找到对应的标签'
  }

  await prisma.patch_tag.delete({
    where: { id: tagId }
  })
  await invalidateTagListCache()

  return {}
}
