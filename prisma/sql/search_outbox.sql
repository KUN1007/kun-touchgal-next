-- M-02: 搜索写出箱表。手动幂等迁移（项目不使用 prisma migrate，建表走
-- `prisma db execute`，勿用 `prisma db push`——push 会按 schema 全量 diff）。
-- 与 prisma/schema/search.prisma 的 model search_outbox 对应。
CREATE TABLE IF NOT EXISTS "search_outbox" (
  "patch_id" INTEGER NOT NULL,
  "seq" INTEGER NOT NULL DEFAULT 0,
  "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "search_outbox_pkey" PRIMARY KEY ("patch_id")
);

CREATE INDEX IF NOT EXISTS "search_outbox_updated_idx"
  ON "search_outbox" ("updated");
