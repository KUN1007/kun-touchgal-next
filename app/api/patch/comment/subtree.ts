import { Prisma } from '~/prisma/generated/prisma/client'

// 删除评论前收集根 + 整棵回复子树的全部 id (parent_id 级联删除会一并带走),
// 供清理审核任务 / 申诉 / 举报等关联记录; 须与删除在同一事务内调用
export const collectCommentSubtreeIds = async (
  ids: number[],
  db: Prisma.TransactionClient
) => {
  const rows = await db.$queryRaw<{ id: number }[]>`
    WITH RECURSIVE descendants AS (
      SELECT id FROM patch_comment WHERE id IN (${Prisma.join(ids)})
      UNION ALL
      SELECT pc.id FROM patch_comment pc
      INNER JOIN descendants d ON pc.parent_id = d.id
    )
    SELECT id FROM descendants
  `
  return rows.map((row) => row.id)
}
