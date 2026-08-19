-- 单独 vndb_id / 单独 vndb_relation_id 形态的唯一性兜底。手动迁移(项目不使用
-- prisma migrate)。
-- 背景:patch 表只有 @@unique([vndb_id, vndb_relation_id]) 组合唯一索引,而
-- Postgres 唯一索引默认 NULLS DISTINCT——任意一列为 NULL 的行不参与冲突,因此
-- (v123, NULL) 与 (NULL, r456) 形态可以无限重复。应用层预检(app/api/edit 的
-- create.ts / update.ts)已挡住同形态重复,本脚本的两个部分唯一索引兜底预检与
-- 写入之间的并发窗口(违反时抛 P2002,与组合索引走同一 catch)。
-- 语义:仅约束"另一半为 NULL"的行,同 vndb_id 不同 relation 的共存(同一作品的
-- 不同 release 条目)不受影响;(NULL, NULL) 行不受任何约束。
-- 部分索引无法在 Prisma schema 中声明;已实测 Prisma 7 的 schema engine
-- (migrate diff / db push 同源)会完全忽略部分索引,日常 `pnpm prisma:push`
-- 不会将其删除。
-- 执行要求:
--   1. 先跑下方"存量重复检查",有结果则必须先人工裁定(合并条目/改正 vndb_id/
--      补 relation_id)再建索引,否则 CREATE UNIQUE INDEX 直接失败;
--   2. 不可用 `prisma db execute --file` 整文件执行——它把多语句批次包进
--      隐式事务,而 CREATE INDEX CONCURRENTLY 不能在事务块内运行;
--      用 psql 执行本文件即可(psql -f 逐语句发送,无隐式事务);
--   3. CONCURRENTLY 失败会残留 INVALID 索引,执行后用 \d patch 确认两个索引
--      均非 INVALID;若有,DROP INDEX 后重跑。
--   psql "$KUN_DATABASE_URL" -f prisma/sql/patch_vndb_solo_unique.sql
--
-- 存量重复检查(有行返回则先人工处理):
--   SELECT vndb_id, COUNT(*) FROM patch
--     WHERE vndb_id IS NOT NULL AND vndb_relation_id IS NULL
--     GROUP BY 1 HAVING COUNT(*) > 1;
--   SELECT vndb_relation_id, COUNT(*) FROM patch
--     WHERE vndb_relation_id IS NOT NULL AND vndb_id IS NULL
--     GROUP BY 1 HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS patch_vndb_id_solo_key
  ON patch (vndb_id) WHERE vndb_relation_id IS NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS patch_vndb_relation_id_solo_key
  ON patch (vndb_relation_id) WHERE vndb_id IS NULL;
