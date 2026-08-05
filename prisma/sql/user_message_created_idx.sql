-- user_message 收件箱排序索引。手动迁移(项目不使用 prisma migrate)。
-- 背景:/message 列表查询 (app/api/message/all/service.ts) 为
-- WHERE recipient_id [+ type] ORDER BY created DESC LIMIT 20,但表上原有
-- 索引均无 created 排序列,255k 行实测:站长号(139k 条)Parallel Seq Scan
-- 全表 + top-N heapsort 约 98ms/次,普通号(4k 条)冷缓存约 102ms;成本随
-- 表体积线性增长。加 (recipient_id, created DESC, id DESC) 后降至 0.1ms,
-- type 过滤分支(9 种枚举分布极不均)另需带 type 的第二个索引。
-- id DESC tiebreaker 与 user_conversation / upffr 既有索引形状保持一致。
-- 索引名与 Prisma 默认命名对齐(schema 已同步加 @@index),防止 db push diff 漂移。
-- 执行要求:
--   1. 不可用 `prisma db execute --file` 整文件执行——它把多语句批次包进
--      隐式事务,而 CREATE INDEX CONCURRENTLY 不能在事务块内运行;
--      用 psql 逐条执行本文件即可(psql -f 逐语句发送,无隐式事务)。
--   2. CONCURRENTLY 失败会残留 INVALID 索引,执行后用 \d user_message
--      确认两个索引均非 INVALID;若有,DROP INDEX 后重跑。
--   psql "$KUN_DATABASE_URL" -f prisma/sql/user_message_created_idx.sql

CREATE INDEX CONCURRENTLY IF NOT EXISTS user_message_recipient_id_created_id_idx
  ON user_message (recipient_id, created DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS user_message_recipient_id_type_created_id_idx
  ON user_message (recipient_id, type, created DESC, id DESC);
