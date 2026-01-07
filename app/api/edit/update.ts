import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { patchUpdateSchema } from '~/validations/edit'
import { handleBatchPatchTags } from './batchTag'

export const updateGalgame = async (
  input: z.infer<typeof patchUpdateSchema>,
  uid: number
) => {
  const patch = await prisma.patch.findUnique({ where: { id: input.id } })
  if (!patch) {
    return '该 ID 下未找到对应 Galgame'
  }

  if (input.vndbId) {
    const galgame = await prisma.patch.findFirst({
      where: { vndb_id: input.vndbId }
    })
    if (galgame && galgame.id !== input.id) {
      return `Galgame VNDB ID 与游戏 ID 为 ${galgame.unique_id} 的游戏重复`
    }
  }

  const {
    id,
    vndbId,
    vndbRelationId,
    name,
    alias,
    introduction,
    contentLimit,
    released
  } = input

  await prisma.patch.update({
    where: { id },
    data: {
      name,
      vndb_id: vndbId ? vndbId : null,
      vndb_relation_id: vndbRelationId ? vndbRelationId : null,
      introduction,
      content_limit: contentLimit,
      released
    }
  })

  await prisma.$transaction(async (prisma) => {
    await prisma.patch_alias.deleteMany({
      where: { patch_id: id }
    })

    const aliasData = alias.map((name) => ({
      name,
      patch_id: id
    }))

    await prisma.patch_alias.createMany({
      data: aliasData,
      skipDuplicates: true
    })
  })

  if (input.tag.length) {
    await handleBatchPatchTags(input.id, input.tag, uid)
  }

  return {}
}
