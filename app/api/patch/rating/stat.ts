import { prisma } from '~/prisma/index'

// Recompute and upsert rating statistics for a patch
export const recomputePatchRatingStat = async (patchId: number) => {
  const agg = await prisma.patch_rating.aggregate({
    where: { patch_id: patchId },
    _avg: { overall: true },
    _count: { _all: true }
  })

  // Recommend counts (explicit counts to avoid complex typings)
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

  // Overall histogram 1..10
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
