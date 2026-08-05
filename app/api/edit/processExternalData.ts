import { prisma } from '~/prisma/index'
import { handleBatchPatchTags } from './batchTag'
import { invalidateCompanyListCache } from '~/app/api/company/cache'
import { invalidateTagListCache } from '~/app/api/tag/cache'

interface SubmittedExternalData {
  vndbTags: string[]
  vndbDevelopers: string[]
  bangumiTags: string[]
  bangumiDevelopers: string[]
  steamTags: string[]
  steamDevelopers: string[]
  steamAliases: string[]
  dlsiteCircleName: string
  dlsiteCircleLink: string
}
interface ExternalDataMutationState {
  tagChanged: boolean
  companyChanged: boolean
}

const ensureTagsWithSources = async (
  patchId: number,
  tagSources: { names: string[]; source: string }[],
  uid: number,
  mutationState: ExternalDataMutationState
) => {
  const tagSourceByName = new Map<string, string>()

  for (const { names, source } of tagSources) {
    for (const name of names) {
      if (name && !tagSourceByName.has(name)) {
        tagSourceByName.set(name, source)
      }
    }
  }

  const validTags = [...tagSourceByName.keys()]
  if (!validTags.length) return false

  const existingTags = await prisma.patch_tag.findMany({
    where: { name: { in: validTags } },
    select: { id: true, name: true }
  })
  const existingNameSet = new Set(existingTags.map((t) => t.name))

  const tagsToCreate = validTags.filter((n) => !existingNameSet.has(n))
  if (tagsToCreate.length) {
    await prisma.patch_tag.createMany({
      data: tagsToCreate.map((name) => ({
        name,
        user_id: uid,
        source: tagSourceByName.get(name) ?? 'self'
      })),
      skipDuplicates: true
    })
    mutationState.tagChanged = true
  }

  const allTags = await prisma.patch_tag.findMany({
    where: { name: { in: validTags } },
    select: { id: true }
  })
  const tagIds = allTags.map((t) => t.id)

  if (!tagIds.length) return tagsToCreate.length > 0

  const existingRelations = await prisma.patch_tag_relation.findMany({
    where: { patch_id: patchId, tag_id: { in: tagIds } },
    select: { tag_id: true }
  })
  const existingRelationIds = new Set(existingRelations.map((r) => r.tag_id))
  const newTagIds = tagIds.filter((id) => !existingRelationIds.has(id))

  if (newTagIds.length) {
    await prisma.patch_tag_relation.createMany({
      data: newTagIds.map((tagId) => ({ patch_id: patchId, tag_id: tagId })),
      skipDuplicates: true
    })
    mutationState.tagChanged = true
  }

  return tagsToCreate.length > 0 || newTagIds.length > 0
}

export const ensureCompanies = async (
  patchId: number,
  names: string[],
  uid: number,
  mutationState: ExternalDataMutationState,
  officialWebsiteByName: Map<string, string[]>
) => {
  // 超出 name VarChar(107) 的名字单独丢弃,避免一条坏名使整批 createMany
  // 失败进而丢掉其余来源的全部关联
  const validNames = [
    ...new Set(names.map((n) => n.trim()).filter(Boolean))
  ].filter((n) => n.length <= 107)
  if (!validNames.length) return false

  const existing = await prisma.patch_company.findMany({
    where: { name: { in: validNames } },
    select: { name: true }
  })
  const existingNameSet = new Set(existing.map((c) => c.name))

  const toCreate = validNames.filter((n) => !existingNameSet.has(n))
  let createdCount = 0
  if (toCreate.length) {
    // skipDuplicates 依赖 patch_company_name_key 唯一索引兜底并发创建
    const created = await prisma.patch_company.createMany({
      data: toCreate.map((name) => ({
        name,
        introduction: '',
        count: 0,
        primary_language: [],
        official_website: officialWebsiteByName.get(name) ?? [],
        parent_brand: [],
        alias: [],
        user_id: uid
      })),
      skipDuplicates: true
    })
    createdCount = created.count
    if (createdCount) {
      mutationState.companyChanged = true
    }
  }

  const allCompanies = await prisma.patch_company.findMany({
    where: { name: { in: validNames } },
    select: { id: true }
  })
  const companyIds = allCompanies.map((c) => c.id)

  if (!companyIds.length) return createdCount > 0

  const insertedRelations = await prisma.patch_company_relation.createMany({
    data: companyIds.map((companyId) => ({
      patch_id: patchId,
      company_id: companyId
    })),
    skipDuplicates: true
  })

  if (insertedRelations.count) {
    mutationState.companyChanged = true
  }

  return createdCount > 0 || insertedRelations.count > 0
}

const ensureAliases = async (patchId: number, aliases: string[]) => {
  const validAliases = [...new Set(aliases.filter(Boolean))]
  if (!validAliases.length) return

  const existing = await prisma.patch_alias.findMany({
    where: { patch_id: patchId, name: { in: validAliases } },
    select: { name: true }
  })
  const existingNames = new Set(existing.map((a) => a.name))
  const toCreate = validAliases.filter((n) => !existingNames.has(n))

  if (toCreate.length) {
    await prisma.patch_alias.createMany({
      data: toCreate.map((name) => ({ name, patch_id: patchId })),
      skipDuplicates: true
    })
  }
}

export const processSubmittedExternalData = async (
  patchId: number,
  data: SubmittedExternalData,
  userTags: string[],
  uid: number
) => {
  const mutationState: ExternalDataMutationState = {
    tagChanged: false,
    companyChanged: false
  }
  if (userTags.length) {
    const result = await handleBatchPatchTags(patchId, userTags, uid)
    mutationState.tagChanged = result.changed
  }

  const tagTask = ensureTagsWithSources(
    patchId,
    [
      { names: data.vndbTags, source: 'vndb' },
      { names: data.bangumiTags, source: 'bangumi' },
      { names: data.steamTags, source: 'steam' }
    ],
    uid,
    mutationState
  )

  // 跨来源合并去重后单次处理,避免多来源同名会社并发重复创建
  const dlsiteCircleName = data.dlsiteCircleName.trim()
  const dlsiteCircleLink = data.dlsiteCircleLink.trim()
  const developerNames = [
    ...data.vndbDevelopers,
    ...data.bangumiDevelopers,
    ...data.steamDevelopers,
    ...(dlsiteCircleName ? [dlsiteCircleName] : [])
  ]
  const officialWebsiteByName = new Map<string, string[]>()
  if (dlsiteCircleName && dlsiteCircleLink) {
    officialWebsiteByName.set(dlsiteCircleName, [dlsiteCircleLink])
  }

  const companyTask = developerNames.length
    ? ensureCompanies(
        patchId,
        developerNames,
        uid,
        mutationState,
        officialWebsiteByName
      )
    : null

  const aliasTasks = [
    data.steamAliases.length && ensureAliases(patchId, data.steamAliases)
  ].filter(Boolean)

  await Promise.allSettled([tagTask, companyTask, ...aliasTasks])

  await Promise.all([
    mutationState.tagChanged ? invalidateTagListCache() : Promise.resolve(),
    mutationState.companyChanged
      ? invalidateCompanyListCache()
      : Promise.resolve()
  ])
}
