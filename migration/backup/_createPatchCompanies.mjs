import { prisma } from '~/prisma/index'

const VNDB_API_BASE = 'https://api.vndb.org/kana'
const BATCH_SIZE = 100
const REQUEST_DELAY = 1000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const uniq = (arr) => Array.from(new Set(arr))

const resetTables = async () => {
  try {
    const tables = [
      { name: 'patch_company', sequence: 'patch_company_id_seq' },
      {
        name: 'patch_company_relation',
        sequence: 'patch_company_relation_id_seq'
      }
    ]

    for (const table of tables) {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "${table.name}" RESTART IDENTITY CASCADE`
      )
    }

    console.log('All tables have been reset successfully.')
  } catch (error) {
    console.error('Error resetting tables:', error)
  } finally {
    await prisma.$disconnect()
  }
}

const fetchBatchVnCompanies = async (vndbIds) => {
  if (!vndbIds.length) return new Map()
  const filters = ['or', ...vndbIds.map((id) => ['id', '=', id])]
  try {
    const res = await fetch(`${VNDB_API_BASE}/vn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters,
        fields:
          'id,developers{id,name,original,aliases,lang,type,description,extlinks{url}}',
        results: vndbIds.length
      })
    })
    if (!res.ok) {
      throw new Error(`VNDB API error: ${res.status} ${res.statusText}`)
    }
    const data = await res.json()
    const map = new Map()
    for (const vn of data.results ?? []) {
      const devs = Array.isArray(vn.developers) ? vn.developers : []
      map.set(
        vn.id,
        devs.filter((d) => d?.type === 'co')
      )
    }
    return map
  } catch (e) {
    console.error('Failed batch VN fetch:', e)
    return new Map()
  }
}

const toCompanyCreate = (producer) => {
  const name = producer?.name ?? ''
  const primary_language = producer?.lang ? [producer.lang] : []
  const aliasRaw = [
    ...(producer?.original ? [producer.original] : []),
    ...(Array.isArray(producer?.aliases) ? producer.aliases : [])
  ].filter(Boolean)
  const alias = uniq(aliasRaw)
  const official_website = Array.isArray(producer?.extlinks)
    ? uniq(producer.extlinks.map((l) => l?.url).filter(Boolean))
    : []
  return {
    name,
    introduction: alias.toString(),
    count: 0,
    primary_language,
    official_website,
    parent_brand: [],
    alias,
    user_id: 1
  }
}

const updateAllCompanyCounts = async () => {
  try {
    const groups = await prisma.patch_company_relation.groupBy({
      by: ['company_id'],
      _count: { _all: true }
    })

    const chunkSize = 200
    for (let i = 0; i < groups.length; i += chunkSize) {
      const slice = groups.slice(i, i + chunkSize)
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(
        slice.map((g) =>
          prisma.patch_company.update({
            where: { id: g.company_id },
            data: { count: g._count._all }
          })
        )
      )
    }
    console.log(`Updated company counts for ${groups.length} companies.`)
  } catch (e) {
    console.error('Failed to update company counts:', e)
  }
}

async function main() {
  try {
    await resetTables()

    const patches = await prisma.patch.findMany({
      where: {
        AND: [{ vndb_id: { not: null } }, { vndb_id: { not: '' } }]
      },
      select: { id: true, vndb_id: true, name: true }
    })

    if (!patches.length) {
      console.log('No patches with vndb_id found.')
      return
    }

    console.log(`Patches with vndb_id: ${patches.length}`)

    for (let i = 0; i < patches.length; i += BATCH_SIZE) {
      const batch = patches.slice(i, i + BATCH_SIZE)
      const ids = batch.map((p) => p.vndb_id)
      console.log(
        `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
          patches.length / BATCH_SIZE
        )} (size=${ids.length})`
      )

      const vnToCompanies = await fetchBatchVnCompanies(ids)

      const companiesByName = new Map()
      for (const comps of vnToCompanies.values()) {
        for (const p of comps) {
          const name = p?.name
          if (!name) continue
          if (!companiesByName.has(name)) {
            companiesByName.set(name, toCompanyCreate(p))
          }
        }
      }

      const companyNames = Array.from(companiesByName.keys())
      if (companyNames.length) {
        const existing = await prisma.patch_company.findMany({
          where: { name: { in: companyNames } },
          select: { id: true, name: true }
        })
        const existingNames = new Set(existing.map((e) => e.name))
        const toCreate = companyNames
          .filter((n) => !existingNames.has(n))
          .map((n) => companiesByName.get(n))

        if (toCreate.length) {
          await prisma.patch_company.createMany({ data: toCreate })
        }

        const allCompanies = await prisma.patch_company.findMany({
          where: { name: { in: companyNames } },
          select: { id: true, name: true }
        })
        const nameToId = new Map(allCompanies.map((c) => [c.name, c.id]))

        const relationRows = []
        for (const p of batch) {
          const comps = vnToCompanies.get(p.vndb_id) || []
          for (const c of comps) {
            const cid = nameToId.get(c.name)
            if (cid) relationRows.push({ patch_id: p.id, company_id: cid })
          }
        }

        if (relationRows.length) {
          await prisma.patch_company_relation.createMany({
            data: relationRows,
            skipDuplicates: true
          })
        }

        console.log(
          `Batch ${Math.floor(i / BATCH_SIZE) + 1}: ensured ${
            toCreate.length
          } companies, created/ensured ${relationRows.length} relations.`
        )
      } else {
        console.log('No companies in this batch.')
      }

      if (i + BATCH_SIZE < patches.length) {
        await sleep(REQUEST_DELAY)
      }
    }

    await updateAllCompanyCounts()

    console.log(
      'Done creating companies and relations for patches with vndb_id'
    )
  } catch (e) {
    console.error(e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
