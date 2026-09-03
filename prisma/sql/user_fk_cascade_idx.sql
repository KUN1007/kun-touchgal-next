-- 指向 user 的外键列前导索引。手动迁移(项目不使用 prisma migrate)。
-- 背景:user.delete() 靠 9 条 CASCADE / SET NULL 外键级联,PostgreSQL 不为外键列
-- 自动建索引,级联触发器对无前导索引的列逐表全表扫描(user_message.sender_id 与
-- patch_rating_like.user_id 借复合索引非前导列做整索引遍历,同样 O(表体积))。
-- 本地快照实测删一个无内容用户:暖 31.4ms,其中这 9 条触发器约 25ms
-- (patch 20MB 宽行顺扫 13.8ms 最贵);建索引后整条 DELETE 1.1ms。
-- 索引名与 Prisma 默认命名对齐(schema 已同步加 @@index),db push 视为已同步。
-- 执行要求:
--   1. 不可用 `prisma db execute --file` 整文件执行——它把多语句批次包进
--      隐式事务,而 CREATE INDEX CONCURRENTLY 不能在事务块内运行;
--      用 psql 逐条执行本文件即可(psql -f 逐语句发送,无隐式事务)。
--   2. CONCURRENTLY 失败会残留 INVALID 索引,执行后用下面的查询确认为 0 行;
--      若有,DROP INDEX 后重跑:
--      SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
--   3. 部署前执行;跳过则 deploy:build 的 db push 会非并发建索引,
--      SHARE 锁阻塞各表写入到建完为止。
--   psql "$KUN_DATABASE_URL" -f prisma/sql/user_fk_cascade_idx.sql

CREATE INDEX CONCURRENTLY IF NOT EXISTS user_message_sender_id_idx
  ON user_message (sender_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS user_private_message_sender_id_idx
  ON user_private_message (sender_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS admin_log_user_id_idx
  ON admin_log (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS patch_rating_like_user_id_idx
  ON patch_rating_like (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS patch_user_id_idx
  ON patch (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS patch_tag_user_id_idx
  ON patch_tag (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS patch_company_user_id_idx
  ON patch_company (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS patch_report_handler_id_idx
  ON patch_report (handler_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS moderation_blacklist_user_id_idx
  ON moderation_blacklist (user_id);
