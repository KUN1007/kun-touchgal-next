import { prisma } from '~/prisma/index'
import { fetchVndbVn } from '~/lib/arnebiae/vndb'
import { invalidateCompanyListCache } from '~/app/api/company/cache'
import type { VndbProducer } from '~/lib/arnebiae/vndb'

const uniq = <T>(arr: T[]) => Array.from(new Set(arr))

const toCompanyCreate = (producer: VndbProducer, uid: number) => {
  const name = producer?.name ?? ''
  const primary_language = producer?.lang ? [producer.lang] : []
  const aliasRaw = [
    ...(producer?.original ? [producer.original] : []),
    ...(Array.isArray(producer?.aliases) ? producer.aliases : [])
  ].filter(Boolean) as string[]
  const alias = uniq(aliasRaw)
  const official_website = Array.isArray(producer?.extlinks)
    ? uniq(
        producer.extlinks
          .map((l) => l?.url)
          .filter(Boolean)
          .map((u) => String(u))
      )
    : []
  return {
    name,
    introduction: alias.toString(),
    count: 0,
    primary_language,
    official_website,
    parent_brand: [] as string[],
    alias,
    user_id: uid
  }
}

export const ensurePatchCompaniesFromVNDB = async (
  patchId: number,
  vndbId: string | null | undefined,
  uid: number
) => {
  const id = (vndbId || '').trim()
  if (!id) return { ensured: 0, related: 0 }
  let changed = false

  try {
    const data = await fetchVndbVn<{
      developers?: VndbProducer[] | null
    }>(
      ['id', '=', id],
      'id,developers{id,name,original,aliases,lang,type,description,extlinks{url}}'
    )

    const devs = (data.results?.[0]?.developers ?? []).filter(
      (d) => d && (d.type === 'co' || d.type === 'ng' || d.type === 'in')
    ) as VndbProducer[]

    if (!devs.length) return { ensured: 0, related: 0 }

    const companiesByName = new Map<
      string,
      ReturnType<typeof toCompanyCreate>
    >()
    for (const p of devs) {
      const name = p?.name
      if (!name) continue
      if (!companiesByName.has(name)) {
        companiesByName.set(name, toCompanyCreate(p, uid))
      }
    }

    const companyNames = Array.from(companiesByName.keys())
    if (!companyNames.length) return { ensured: 0, related: 0 }

    const existing = await prisma.patch_company.findMany({
      where: { name: { in: companyNames } },
      select: { id: true, name: true }
    })
    const existingNames = new Set(existing.map((e) => e.name))

    const toCreate = companyNames
      .filter((n) => !existingNames.has(n))
      .map((n) => companiesByName.get(n)!)

    if (toCreate.length) {
      await prisma.patch_company.createMany({ data: toCreate })
      changed = true
    }

    const allCompanies = await prisma.patch_company.findMany({
      where: { name: { in: companyNames } },
      select: { id: true, name: true }
    })
    const nameToId = new Map(allCompanies.map((c) => [c.name, c.id]))
    const companyIds = allCompanies.map((c) => c.id)

    if (companyIds.length) {
      const existingRelations = await prisma.patch_company_relation.findMany({
        where: {
          patch_id: patchId,
          company_id: { in: companyIds }
        },
        select: { company_id: true }
      })
      const existingCompanyIds = new Set(
        existingRelations.map((r) => r.company_id)
      )

      const newCompanyIds = companyIds.filter(
        (cid) => !existingCompanyIds.has(cid)
      )

      await prisma.patch_company_relation.createMany({
        data: companyNames
          .map((n) => nameToId.get(n))
          .filter((cid): cid is number => typeof cid === 'number')
          .map((cid) => ({ patch_id: patchId, company_id: cid })),
        skipDuplicates: true
      })

      if (newCompanyIds.length) {
        await prisma.patch_company.updateMany({
          where: { id: { in: newCompanyIds } },
          data: { count: { increment: 1 } }
        })
        changed = true
      }
    }

    return { ensured: toCreate.length, related: companyIds.length }
  } catch {
    return { ensured: 0, related: 0 }
  } finally {
    if (changed) {
      await invalidateCompanyListCache()
    }
  }
}
