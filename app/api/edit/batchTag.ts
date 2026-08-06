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

  // 计数触发器只保证单语句内按 tag_id 升序加锁; 本事务先 INSERT 后 DELETE,
  // 两语句锁集分离, 与反向并发编辑成环死锁。事务首条对并集升序预加锁建立全序。
  // FOR NO KEY UPDATE 与 FK RI 的 KEY SHARE 相容, 只串行化触发器 UPDATE count 的竞争者。
  // tagsToCreate 新建的 tag 不入锁集: 未提交的新行对并发事务不可见, 无竞争者。
  const lockIds = [
    ...new Set([...existingTags.map((tag) => tag.id), ...tagsToRemove])
  ].sort((a, b) => a - b)

  await prisma.$transaction(
    async (tx) => {
      if (lockIds.length > 0) {
        await tx.$queryRaw`SELECT id FROM patch_tag WHERE id = ANY(${lockIds}::int4[]) ORDER BY id FOR NO KEY UPDATE`
      }

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
      }

      if (tagsToRemove.length > 0) {
        await tx.patch_tag_relation.deleteMany({
          where: { patch_id: patchId, tag_id: { in: tagsToRemove } }
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
