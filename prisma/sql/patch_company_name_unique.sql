-- 会社名去重 + name 唯一索引。手动幂等迁移(项目不使用 prisma migrate,
-- 执行走 `prisma db execute`,勿用 `prisma db push`——push 会按 schema 全量 diff)。
-- 背景:patch_company.name 无唯一约束,创建游戏时多来源(VNDB/Bangumi/Steam/DLsite)
-- 同名会社并发写入产生重复记录;relation 插入与 count 递增非原子导致 count 虚增。
-- 本脚本:1) 同名会社合并到最小 id(keeper);2) 关联去重后改指 keeper;
-- 3) 全量重算 count;4) 以唯一索引替换普通索引(名称与 Prisma schema 对齐)。
-- 执行要求:
--   1. 先备份 patch_company / patch_company_relation 两表;
--   2. 在写静默窗口执行(暂停应用写入)——脚本语句各自取快照,老代码并发写入
--      可能落在快照后被级联删除(丢关联)或使唯一索引构建失败回滚;
--   3. 执行后必须跑 `pnpm search:sync-all`——relation 改指/删除不经应用层,
--      Meilisearch 文档内嵌的 companyIds 不会自动更新,不重建会漏搜。
--   npx prisma db execute --file prisma/sql/patch_company_name_unique.sql

BEGIN;

CREATE TEMP TABLE tmp_company_dedup AS
SELECT id, keeper_id
FROM (
  SELECT id, MIN(id) OVER (PARTITION BY name) AS keeper_id
  FROM patch_company
) t
WHERE id <> keeper_id;

-- 同一 patch 关联到同名组内多条会社时,每组只保留 relation id 最小的一条
DELETE FROM patch_company_relation
WHERE id IN (
  SELECT id FROM (
    SELECT r.id,
           ROW_NUMBER() OVER (
             PARTITION BY r.patch_id, COALESCE(d.keeper_id, r.company_id)
             ORDER BY r.id
           ) AS rn
    FROM patch_company_relation r
    LEFT JOIN tmp_company_dedup d ON d.id = r.company_id
  ) ranked
  WHERE rn > 1
);

-- 剩余指向重复会社的关联改指 keeper
UPDATE patch_company_relation r
SET company_id = d.keeper_id
FROM tmp_company_dedup d
WHERE r.company_id = d.id;

-- 删除重复会社
DELETE FROM patch_company c
USING tmp_company_dedup d
WHERE c.id = d.id;

-- 全量重算 count,修正历史虚增
UPDATE patch_company c
SET count = agg.cnt
FROM (
  SELECT company_id, COUNT(*)::int AS cnt
  FROM patch_company_relation
  GROUP BY company_id
) agg
WHERE c.id = agg.company_id AND c.count <> agg.cnt;

UPDATE patch_company c
SET count = 0
WHERE c.count <> 0
  AND NOT EXISTS (
    SELECT 1 FROM patch_company_relation r WHERE r.company_id = c.id
  );

DROP INDEX IF EXISTS patch_company_name_idx;
CREATE UNIQUE INDEX IF NOT EXISTS patch_company_name_key ON patch_company (name);

DROP TABLE tmp_company_dedup;

COMMIT;
