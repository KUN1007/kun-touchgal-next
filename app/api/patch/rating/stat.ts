import { prisma } from '~/prisma/index'
import type { Prisma } from '~/prisma/generated/prisma/client'

// 通告锁命名空间: 与 patch type 锁 (recalcPatchType) 分属不同域, 同 patch 的评分统计
// 重算按 (域, patchId) 串行
const RATING_STAT_LOCK_NAMESPACE = 481002

type PatchRatingStatData = Omit<
  Prisma.patch_rating_statModel,
  'patch_id' | 'created' | 'updated'
>

// Recompute and upsert rating statistics for a patch
export const recomputePatchRatingStat = async (patchId: number) => {
  await prisma.$transaction(async (tx) => {
    // pg_advisory_xact_lock: 事务级通告锁, 使同一 patch 的「聚合读 → upsert 写」原子化,
    // 消除重叠重算 (审核重叠批次、管理员与用户并发操作) 的丢更新. 用 $executeRaw
    // (而非 $queryRaw): pg adapter 无法反序列化 void; ::int 匹配 (int,int) 重载
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RATING_STAT_LOCK_NAMESPACE}::int, ${patchId}::int)`

    // 仅 status=0 (正常) 的评价计入统计; 待审核 (1) 与隐藏 (2) 均排除
    const [ratingStat] = await tx.$queryRaw<PatchRatingStatData[]>`
      SELECT
        COALESCE(AVG(overall), 0)::double precision AS avg_overall,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE recommend = 'strong_no')::int AS rec_strong_no,
        COUNT(*) FILTER (WHERE recommend = 'no')::int AS rec_no,
        COUNT(*) FILTER (WHERE recommend = 'neutral')::int AS rec_neutral,
        COUNT(*) FILTER (WHERE recommend = 'yes')::int AS rec_yes,
        COUNT(*) FILTER (WHERE recommend = 'strong_yes')::int AS rec_strong_yes,
        COUNT(*) FILTER (WHERE overall = 1)::int AS o1,
        COUNT(*) FILTER (WHERE overall = 2)::int AS o2,
        COUNT(*) FILTER (WHERE overall = 3)::int AS o3,
        COUNT(*) FILTER (WHERE overall = 4)::int AS o4,
        COUNT(*) FILTER (WHERE overall = 5)::int AS o5,
        COUNT(*) FILTER (WHERE overall = 6)::int AS o6,
        COUNT(*) FILTER (WHERE overall = 7)::int AS o7,
        COUNT(*) FILTER (WHERE overall = 8)::int AS o8,
        COUNT(*) FILTER (WHERE overall = 9)::int AS o9,
        COUNT(*) FILTER (WHERE overall = 10)::int AS o10
      FROM patch_rating
      WHERE patch_id = ${patchId} AND status = 0
    `

    await tx.patch_rating_stat.upsert({
      where: { patch_id: patchId },
      create: { patch_id: patchId, ...ratingStat },
      update: ratingStat
    })
  })
}
