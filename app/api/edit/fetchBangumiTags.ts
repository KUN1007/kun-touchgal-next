import { prisma } from '~/prisma/index'
import { BANGUMI_API_BASE, BANGUMI_HEADERS } from '~/constants/bangumi'
import { lowQualityTags } from '~/lib/bgmDirtyTag'
import { invalidateTagListCache } from '~/app/api/tag/cache'

interface BangumiTag {
  name: string
  count: number
}

interface BangumiSubjectResponse {
  id: number
  tags?: BangumiTag[]
}

const MIN_TAG_COUNT = 10
const dirtyTagSet = new Set(lowQualityTags)

export const ensurePatchTagsFromBangumi = async (
  patchId: number,
  bangumiId: number,
  uid: number
) => {
  const hasTag = await prisma.patch_tag_relation.findFirst({
    where: { patch_id: patchId, tag: { source: 'bangumi' } },
    select: { id: true }
  })
  if (hasTag) return { ensured: 0, related: 0 }

  try {
    const res = await fetch(`${BANGUMI_API_BASE}/v0/subjects/${bangumiId}`, {
      headers: BANGUMI_HEADERS
    })

    if (!res.ok) return { ensured: 0, related: 0 }

    const data = (await res.json()) as BangumiSubjectResponse
    const allTags = data.tags ?? []

    const filteredTags = allTags.filter(
      (t) => t.count >= MIN_TAG_COUNT && !dirtyTagSet.has(t.name)
    )

    if (!filteredTags.length) return { ensured: 0, related: 0 }

    const tagNames = filteredTags.map((t) => t.name)

    const existingTags = await prisma.patch_tag.findMany({
      where: { name: { in: tagNames } },
      select: { id: true, name: true }
    })
    const existingNameSet = new Set(existingTags.map((t) => t.name))

    const tagsToCreate = filteredTags.filter(
      (t) => !existingNameSet.has(t.name)
    )
    let changed = tagsToCreate.length > 0

    if (tagsToCreate.length) {
      await prisma.patch_tag.createMany({
        data: tagsToCreate.map((t) => ({
          name: t.name,
          user_id: uid,
          source: 'bangumi'
        })),
        skipDuplicates: true
      })
    }

    const allRelevantTags = await prisma.patch_tag.findMany({
      where: { name: { in: tagNames } },
      select: { id: true }
    })
    const tagIds = allRelevantTags.map((t) => t.id)

    if (tagIds.length) {
      const existingRelations = await prisma.patch_tag_relation.findMany({
        where: { patch_id: patchId, tag_id: { in: tagIds } },
        select: { tag_id: true }
      })
      const existingRelationIds = new Set(
        existingRelations.map((r) => r.tag_id)
      )
      const newTagIds = tagIds.filter((id) => !existingRelationIds.has(id))

      if (newTagIds.length) {
        await prisma.patch_tag_relation.createMany({
          data: newTagIds.map((tagId) => ({
            patch_id: patchId,
            tag_id: tagId
          })),
          skipDuplicates: true
        })
        changed = true
      }
    }
    if (changed) {
      await invalidateTagListCache()
    }

    return { ensured: tagsToCreate.length, related: tagIds.length }
  } catch {
    return { ensured: 0, related: 0 }
  }
}
