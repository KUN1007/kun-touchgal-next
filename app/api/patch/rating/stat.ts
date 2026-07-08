import { prisma } from '~/prisma/index'

// 通告锁命名空间: 与 patch type 锁 (recalcPatchType) 分属不同域, 同 patch 的评分统计
// 重算按 (域, patchId) 串行
const RATING_STAT_LOCK_NAMESPACE = 481002

// Recompute and upsert rating statistics for a patch
export const recomputePatchRatingStat = async (patchId: number) => {
  await prisma.$transaction(async (tx) => {
    // pg_advisory_xact_lock: 事务级通告锁, 使同一 patch 的「聚合读 → upsert 写」原子化,
    // 消除重叠重算 (审核重叠批次、管理员与用户并发操作) 的丢更新. 交互事务不支持并发
    // 查询, 故原 Promise.all 并行读改为顺序 await——评分重算低频, 代价可忽略. 用
    // $executeRaw (而非 $queryRaw): pg adapter 无法反序列化 void; ::int 匹配 (int,int) 重载
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RATING_STAT_LOCK_NAMESPACE}::int, ${patchId}::int)`

    // 仅 status=0 (正常) 的评价计入统计; 待审核 (1) 与隐藏 (2) 均排除
    const agg = await tx.patch_rating.aggregate({
      where: { patch_id: patchId, status: 0 },
      _avg: { overall: true },
      _count: { _all: true }
    })

    // Recommend counts (explicit counts to avoid complex typings)
    const countRecommend = (recommend: string) =>
      tx.patch_rating.count({
        where: { patch_id: patchId, status: 0, recommend }
      })
    const strong_no = await countRecommend('strong_no')
    const no = await countRecommend('no')
    const neutral = await countRecommend('neutral')
    const yes = await countRecommend('yes')
    const strong_yes = await countRecommend('strong_yes')

    // Overall histogram 1..10
    const histCounts: number[] = []
    for (let overall = 1; overall <= 10; overall++) {
      histCounts.push(
        await tx.patch_rating.count({
          where: { patch_id: patchId, status: 0, overall }
        })
      )
    }

    await tx.patch_rating_stat.upsert({
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
  })
}
