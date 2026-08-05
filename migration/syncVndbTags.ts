import 'dotenv/config'
import { prisma } from '~/prisma/index'
import { VNDB_API_BASE, VNDB_API_HEADERS } from '~/lib/arnebiae/vndb'
import { TAG_MAP } from '~/lib/tagMap'

const BATCH_SIZE = 50
const REQUEST_DELAY = 1500
const SYSTEM_USER_ID = 1

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface VndbTag {
  id: string
  name: string
  rating: number
  spoiler: number
  lie: boolean
  category: string
}

interface VndbVnResult {
  id: string
  tags: VndbTag[]
}

async function syncVndbTags() {
  console.log('Step 1: 获取有 VNDB ID 的 patch...')

  const patches = await prisma.patch.findMany({
    where: { vndb_id: { not: null } },
    select: {
      id: true,
      vndb_id: true,
      unique_id: true,
      tag: {
        where: { tag: { source: 'vndb' } },
        select: { id: true },
        take: 1
      }
    },
    orderBy: { id: 'asc' }
  })

  const patchesToSync = patches.filter((p) => p.tag.length === 0)
  const skippedCount = patches.length - patchesToSync.length

  console.log(
    `找到 ${patches.length} 个有 VNDB ID 的 patch，` +
      `跳过 ${skippedCount} 个已有 VNDB tag 的 patch，` +
      `需同步 ${patchesToSync.length} 个`
  )

  if (!patchesToSync.length) {
    console.log('无需同步，脚本结束')
    return
  }

  const vndbIdToPatchMap = new Map(patchesToSync.map((p) => [p.vndb_id!, p]))

  let successCount = 0
  let noTagCount = 0
  let failCount = 0
  let totalEnsured = 0
  let totalRelated = 0

  const totalBatches = Math.ceil(patchesToSync.length / BATCH_SIZE)

  for (let i = 0; i < patchesToSync.length; i += BATCH_SIZE) {
    const batch = patchesToSync.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const batchVndbIds = batch.map((p) => p.vndb_id!)

    console.log(`\n批次 ${batchNum}/${totalBatches} (${batch.length} 个 patch)`)

    try {
      const body = {
        filters: ['or', ...batchVndbIds.map((id) => ['id', '=', id])],
        fields: 'id,tags{id,name,rating,spoiler,lie,category}',
        results: batch.length
      }

      const response = await fetch(`${VNDB_API_BASE}/vn`, {
        method: 'POST',
        headers: VNDB_API_HEADERS,
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        throw new Error(
          `API 请求失败: ${response.status} ${response.statusText}`
        )
      }

      const data = (await response.json()) as { results: VndbVnResult[] }

      for (const vn of data.results) {
        const patch = vndbIdToPatchMap.get(vn.id)
        if (!patch) continue

        const filteredTags = (vn.tags || []).filter(
          (t) =>
            !t.lie &&
            t.spoiler === 0 &&
            (t.category === 'cont' || t.category === 'tech')
        )

        if (!filteredTags.length) {
          noTagCount++
          continue
        }

        try {
          const result = await processPatchTags(
            patch.id,
            filteredTags,
            SYSTEM_USER_ID
          )
          successCount++
          totalEnsured += result.ensured
          totalRelated += result.related
          console.log(
            `  ${patch.unique_id} (${vn.id}): 新建=${result.ensured}, 关联=${result.related}`
          )
        } catch (error) {
          failCount++
          console.error(`  ${patch.unique_id} (${vn.id}): 处理失败`, error)
        }
      }

      const fetchedIds = new Set(data.results.map((vn) => vn.id))
      for (const p of batch) {
        if (!fetchedIds.has(p.vndb_id!)) {
          noTagCount++
        }
      }
    } catch (error) {
      failCount += batch.length
      console.error(`  批次请求失败:`, error)
    }

    if (i + BATCH_SIZE < patchesToSync.length) {
      await sleep(REQUEST_DELAY)
    }
  }

  console.log(`\n同步完成:`)
  console.log(
    `  成功: ${successCount} (新建标签 ${totalEnsured}, 关联 ${totalRelated})`
  )
  console.log(`  无匹配标签: ${noTagCount}`)
  console.log(`  失败: ${failCount}`)
  console.log(`  已跳过 (已有 VNDB tag): ${skippedCount}`)
  console.log(`  总计: ${patches.length}`)
}

async function processPatchTags(
  patchId: number,
  filteredTags: VndbTag[],
  uid: number
) {
  const vndbOriginalNames = filteredTags.map((t) => t.name)

  const existingTags = await prisma.patch_tag.findMany({
    where: { vndb_original_name: { in: vndbOriginalNames } },
    select: { id: true, vndb_original_name: true }
  })
  const existingNameSet = new Set(existingTags.map((t) => t.vndb_original_name))

  const tagsToCreate = filteredTags.filter((t) => !existingNameSet.has(t.name))

  const mappedNames = tagsToCreate.map((t) => TAG_MAP[t.name] || t.name)
  const conflictingTags = await prisma.patch_tag.findMany({
    where: { name: { in: mappedNames } },
    select: { id: true, name: true }
  })
  const conflictNameSet = new Set(conflictingTags.map((t) => t.name))

  const reallyToCreate = tagsToCreate.filter((t) => {
    const mappedName = TAG_MAP[t.name] || t.name
    return !conflictNameSet.has(mappedName)
  })

  if (reallyToCreate.length) {
    await prisma.patch_tag.createMany({
      data: reallyToCreate.map((t) => ({
        name: TAG_MAP[t.name] || t.name,
        user_id: uid,
        source: 'vndb',
        vndb_original_name: t.name,
        vndb_category: t.category,
        vndb_spoiler: t.spoiler,
        vndb_rating: t.rating
      })),
      skipDuplicates: true
    })
  }

  const allMappedNames = filteredTags.map((t) => TAG_MAP[t.name] || t.name)
  const allRelevantTags = await prisma.patch_tag.findMany({
    where: {
      OR: [
        { vndb_original_name: { in: vndbOriginalNames } },
        { name: { in: allMappedNames } }
      ]
    },
    select: { id: true }
  })
  const tagIds = allRelevantTags.map((t) => t.id)

  if (!tagIds.length) return { ensured: 0, related: 0 }

  const existingRelations = await prisma.patch_tag_relation.findMany({
    where: { patch_id: patchId, tag_id: { in: tagIds } },
    select: { tag_id: true }
  })
  const existingRelationIds = new Set(existingRelations.map((r) => r.tag_id))
  const newTagIds = tagIds.filter((id) => !existingRelationIds.has(id))

  if (newTagIds.length) {
    await prisma.patch_tag_relation.createMany({
      data: newTagIds.map((tagId) => ({
        patch_id: patchId,
        tag_id: tagId
      })),
      skipDuplicates: true
    })
  }

  return { ensured: reallyToCreate.length, related: tagIds.length }
}

syncVndbTags()
  .catch((error) => {
    console.error('Migration failed:', error)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
