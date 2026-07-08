import 'dotenv/config'
import { prisma } from '~/prisma/index'

// resource_count / comment_count 仅统计 status=0 (正常) 的行:
// 待审核 / 隐藏内容不计入卡片上的公开计数; favorite 关系无 status, 全量计数
const BACKFILL_SQL = `
UPDATE "patch" p
SET
  favorite_count = COALESCE(f.c, 0),
  resource_count = COALESCE(r.c, 0),
  comment_count  = COALESCE(c.c, 0)
FROM (SELECT id FROM "patch") base
LEFT JOIN (
  SELECT patch_id, COUNT(*)::int AS c
  FROM "user_patch_favorite_folder_relation"
  GROUP BY patch_id
) f ON f.patch_id = base.id
LEFT JOIN (
  SELECT patch_id, COUNT(*)::int AS c
  FROM "patch_resource"
  WHERE status = 0
  GROUP BY patch_id
) r ON r.patch_id = base.id
LEFT JOIN (
  SELECT patch_id, COUNT(*)::int AS c
  FROM "patch_comment"
  WHERE status = 0
  GROUP BY patch_id
) c ON c.patch_id = base.id
WHERE p.id = base.id;
`

// 无 status 的关系表 (favorite): 计数只随行增删迁移
const buildRelationCounterTrigger = (
  name: string,
  column: string,
  table: string
): string[] => [
  `
CREATE OR REPLACE FUNCTION ${name}() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "patch" SET ${column} = ${column} + 1 WHERE id = NEW.patch_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "patch" SET ${column} = GREATEST(${column} - 1, 0) WHERE id = OLD.patch_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.patch_id IS DISTINCT FROM OLD.patch_id THEN
    UPDATE "patch" SET ${column} = GREATEST(${column} - 1, 0) WHERE id = OLD.patch_id;
    UPDATE "patch" SET ${column} = ${column} + 1 WHERE id = NEW.patch_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql
`,
  `DROP TRIGGER IF EXISTS ${name} ON "${table}"`,
  `
CREATE TRIGGER ${name}
AFTER INSERT OR DELETE OR UPDATE OF patch_id
ON "${table}"
FOR EACH ROW EXECUTE FUNCTION ${name}()
`
]

// 带 status 的内容表 (resource/comment): 仅 status=0 计入;
// status 在 0 与非 0 之间迁移 (待审核↔正常, 正常↔隐藏) 时同步增减计数
const buildStatusCounterTrigger = (
  name: string,
  column: string,
  table: string
): string[] => [
  `
CREATE OR REPLACE FUNCTION ${name}() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 0 THEN
      UPDATE "patch" SET ${column} = ${column} + 1 WHERE id = NEW.patch_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 0 THEN
      UPDATE "patch" SET ${column} = GREATEST(${column} - 1, 0) WHERE id = OLD.patch_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.patch_id IS DISTINCT FROM OLD.patch_id THEN
      IF OLD.status = 0 THEN
        UPDATE "patch" SET ${column} = GREATEST(${column} - 1, 0) WHERE id = OLD.patch_id;
      END IF;
      IF NEW.status = 0 THEN
        UPDATE "patch" SET ${column} = ${column} + 1 WHERE id = NEW.patch_id;
      END IF;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status = 0 AND NEW.status <> 0 THEN
        UPDATE "patch" SET ${column} = GREATEST(${column} - 1, 0) WHERE id = NEW.patch_id;
      ELSIF OLD.status <> 0 AND NEW.status = 0 THEN
        UPDATE "patch" SET ${column} = ${column} + 1 WHERE id = NEW.patch_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql
`,
  `DROP TRIGGER IF EXISTS ${name} ON "${table}"`,
  `
CREATE TRIGGER ${name}
AFTER INSERT OR DELETE OR UPDATE OF patch_id, status
ON "${table}"
FOR EACH ROW EXECUTE FUNCTION ${name}()
`
]

const TRIGGER_STATEMENTS: string[] = [
  ...buildRelationCounterTrigger(
    'patch_favorite_count_trg',
    'favorite_count',
    'user_patch_favorite_folder_relation'
  ),
  ...buildStatusCounterTrigger(
    'patch_resource_count_trg',
    'resource_count',
    'patch_resource'
  ),
  ...buildStatusCounterTrigger(
    'patch_comment_count_trg',
    'comment_count',
    'patch_comment'
  )
]

// 建议在低峰 / 维护窗口执行: backfill 前对内容表加 SHARE 锁会短暂阻塞写入
const main = async () => {
  try {
    console.log('Installing patch counter triggers and backfilling...')
    // 装触发器与 backfill 放进单个事务, 并在 backfill 前对内容表加 SHARE 锁:
    // 阻塞并发写 (与 ROW EXCLUSIVE 冲突), 消除"绝对重算 backfill 覆盖触发器 +1"
    // 的竞态; 事务提交后自动释放锁, 计数最终与内容一致
    await prisma.$transaction(
      async (tx) => {
        for (const stmt of TRIGGER_STATEMENTS) {
          await tx.$executeRawUnsafe(stmt)
        }
        await tx.$executeRawUnsafe(
          'LOCK TABLE "patch_comment", "patch_resource", "user_patch_favorite_folder_relation" IN SHARE MODE'
        )
        await tx.$executeRawUnsafe(BACKFILL_SQL)
      },
      { timeout: 10 * 60 * 1000 }
    )
    console.log('Triggers installed and counters backfilled.')
  } catch (e) {
    console.error(e)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
