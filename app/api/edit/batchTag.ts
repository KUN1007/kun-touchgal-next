import { prisma } from '~/prisma/index'

export const handleBatchPatchTags = async (
  patchId: number,
  tagArray: string[],
  uid: number
) => {
  const validTags = tagArray.filter(Boolean)

  const existingRelations = await prisma.patch_tag_relation.findMany({
    where: { patch_id: patchId },
    include: { tag: true }
  })

  const existingTagNames = existingRelations.map((rel) => rel.tag.name)
  const tagsToAdd = validTags.filter((tag) => !existingTagNames.includes(tag))
  const tagsToRemove = existingRelations
    .filter((rel) => !validTags.includes(rel.tag.name))
    .map((rel) => rel.tag_id)

  const existingTags =
    tagsToAdd.length > 0
      ? await prisma.patch_tag.findMany({
          where: {
            OR: tagsToAdd.map((tag) => ({
              OR: [{ name: tag }, { alias: { has: tag } }]
            }))
          }
        })
      : []

  const existingTagMap = new Map(existingTags.map((tag) => [tag.name, tag]))
  const tagsToCreate = [
    ...new Set(tagsToAdd.filter((tag) => !existingTagMap.has(tag)))
  ]

  await prisma.$transaction(
    async (tx) => {
      if (tagsToCreate.length > 0) {
        await tx.patch_tag.createMany({
          data: tagsToCreate.map((name) => ({
            user_id: uid,
            name,
            source: 'self'
          }))
        })
      }

      const newTags =
        tagsToCreate.length > 0
          ? await tx.patch_tag.findMany({
              where: { name: { in: tagsToCreate } },
              select: { id: true, name: true }
            })
          : []

      const allTagIds = [
        ...existingTags.map((t) => t.id),
        ...newTags.map((t) => t.id)
      ]

      if (allTagIds.length > 0) {
        await tx.patch_tag_relation.createMany({
          data: allTagIds.map((tagId) => ({
            patch_id: patchId,
            tag_id: tagId
          }))
        })

        await tx.patch_tag.updateMany({
          where: { id: { in: allTagIds } },
          data: { count: { increment: 1 } }
        })
      }

      if (tagsToRemove.length > 0) {
        await tx.patch_tag_relation.deleteMany({
          where: { patch_id: patchId, tag_id: { in: tagsToRemove } }
        })

        await tx.patch_tag.updateMany({
          where: { id: { in: tagsToRemove } },
          data: { count: { decrement: 1 } }
        })
      }
    },
    { timeout: 60000 }
  )

  return {
    success: true,
    changed: tagsToAdd.length > 0 || tagsToRemove.length > 0
  }
}
