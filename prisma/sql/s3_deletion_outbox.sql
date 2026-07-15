-- M-03: S3 删除写出箱表。手动幂等迁移（项目不使用 prisma migrate，建表走
-- `prisma db execute`，勿用 `prisma db push`——push 会按 schema 全量 diff）。
-- 与 prisma/schema/storage.prisma 的 model s3_deletion_outbox 对应。
CREATE TABLE IF NOT EXISTS "s3_deletion_outbox" (
  "s3_key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "s3_deletion_outbox_pkey" PRIMARY KEY ("s3_key")
);

CREATE INDEX IF NOT EXISTS "s3_deletion_outbox_updated_idx"
  ON "s3_deletion_outbox" ("updated");
