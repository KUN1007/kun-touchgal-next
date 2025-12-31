import { prisma } from '~/prisma/index'

const batch = async (arr, size, fn) => {
  for (let i = 0; i < arr.length; i += size) {
    const slice = arr.slice(i, i + size)
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(slice.map(fn))
  }
}

const recomputeForPatch = async (patchId) => {
  const agg = await prisma.patch_rating.aggregate({
    where: { patch_id: patchId },
    _avg: { overall: true },
    _count: { _all: true }
  })

  const [strong_no, no, neutral, yes, strong_yes] = await Promise.all([
    prisma.patch_rating.count({
      where: { patch_id: patchId, recommend: 'strong_no' }
    }),
    prisma.patch_rating.count({
      where: { patch_id: patchId, recommend: 'no' }
    }),
    prisma.patch_rating.count({
      where: { patch_id: patchId, recommend: 'neutral' }
    }),
    prisma.patch_rating.count({
      where: { patch_id: patchId, recommend: 'yes' }
    }),
    prisma.patch_rating.count({
      where: { patch_id: patchId, recommend: 'strong_yes' }
    })
  ])

  const histCounts = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      prisma.patch_rating.count({
        where: { patch_id: patchId, overall: i + 1 }
      })
    )
  )

  await prisma.patch_rating_stat.upsert({
    where: { patch_id: patchId },
    create: {
      patch_id: patchId,
      avg_overall: agg._avg.overall ?? 0,
      count: agg._count._all ?? 0,
      rec_strong_no: strong_no,
      rec_no: no,
      rec_neutral: neutral,
      rec_yes: yes,
      rec_strong_yes: strong_yes,
      o1: histCounts[0],
      o2: histCounts[1],
      o3: histCounts[2],
      o4: histCounts[3],
      o5: histCounts[4],
      o6: histCounts[5],
      o7: histCounts[6],
      o8: histCounts[7],
      o9: histCounts[8],
      o10: histCounts[9]
    },
    update: {
      avg_overall: agg._avg.overall ?? 0,
      count: agg._count._all ?? 0,
      rec_strong_no: strong_no,
      rec_no: no,
      rec_neutral: neutral,
      rec_yes: yes,
      rec_strong_yes: strong_yes,
      o1: histCounts[0],
      o2: histCounts[1],
      o3: histCounts[2],
      o4: histCounts[3],
      o5: histCounts[4],
      o6: histCounts[5],
      o7: histCounts[6],
      o8: histCounts[7],
      o9: histCounts[8],
      o10: histCounts[9]
    }
  })
}

async function main() {
  try {
    const patches = await prisma.patch.findMany({ select: { id: true } })
    const stats = await prisma.patch_rating_stat.findMany({
      select: { patch_id: true }
    })
    const hasStat = new Set(stats.map((s) => s.patch_id))
    const missing = patches.map((p) => p.id).filter((id) => !hasStat.has(id))

    const ids = missing.length ? missing : patches.map((p) => p.id)
    console.log(`Patches to ensure rating_stat: ${ids.length}`)

    await batch(ids, 20, async (id) => recomputeForPatch(id))

    console.log('Done ensuring patch_rating_stat for all patches')
  } catch (e) {
    console.error(e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
