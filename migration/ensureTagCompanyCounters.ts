import 'dotenv/config'
import { prisma } from '~/prisma/index'

// patch_tag.count / patch_company.count 由关系表行数驱动:
// 关系行随 patch 级联删除 / user 级联删除 / 显式解绑消失时同步递减, 插入时递增。
// 行级触发器在 ON DELETE CASCADE 下逐行触发, 关闭删除侧漏减;
// skipDuplicates 冲突未实插的行不触发, 并发重复 increment 口子一并关闭。
// 上线顺序: 先部署拆除应用层手工计数的代码, 再跑本脚本 —— 窗口期漏计由
// 同事务的全量 backfill 一并修正; 顺序颠倒则窗口期双计且无法自愈。

// 无 status 的纯关系表: 父表 count 只随关系行增删迁移
const buildRelationCounterTrigger = (
  name: string,
  parentTable: string,
  fkColumn: string,
  relationTable: string
): string[] => [
  `
CREATE OR REPLACE FUNCTION ${name}() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "${parentTable}" SET count = count + 1 WHERE id = NEW.${fkColumn};
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "${parentTable}" SET count = GREATEST(count - 1, 0) WHERE id = OLD.${fkColumn};
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.${fkColumn} IS DISTINCT FROM OLD.${fkColumn} THEN
    UPDATE "${parentTable}" SET count = GREATEST(count - 1, 0) WHERE id = OLD.${fkColumn};
    UPDATE "${parentTable}" SET count = count + 1 WHERE id = NEW.${fkColumn};
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql
`,
  `DROP TRIGGER IF EXISTS ${name} ON "${relationTable}"`,
  `
CREATE TRIGGER ${name}
AFTER INSERT OR DELETE OR UPDATE OF ${fkColumn}
ON "${relationTable}"
FOR EACH ROW EXECUTE FUNCTION ${name}()
`
]

// 全量覆盖式重算: 同时修正存量超计与零关联残留
const buildBackfillSql = (
  parentTable: string,
  fkColumn: string,
  relationTable: string
): string => `
UPDATE "${parentTable}" p
SET count = COALESCE(r.c, 0)
FROM (SELECT id FROM "${parentTable}") base
LEFT JOIN (
  SELECT ${fkColumn}, COUNT(*)::int AS c
  FROM "${relationTable}"
  GROUP BY ${fkColumn}
) r ON r.${fkColumn} = base.id
WHERE p.id = base.id;
`

const TRIGGER_STATEMENTS: string[] = [
  ...buildRelationCounterTrigger(
    'patch_tag_count_trg',
    'patch_tag',
    'tag_id',
    'patch_tag_relation'
  ),
  ...buildRelationCounterTrigger(
    'patch_company_count_trg',
    'patch_company',
    'company_id',
    'patch_company_relation'
  )
]

// 建议在低峰 / 维护窗口执行: backfill 前对关系表加 SHARE 锁会短暂阻塞写入
const main = async () => {
  try {
    console.log('Installing tag/company counter triggers and backfilling...')
    // 装触发器与 backfill 放进单个事务, 并在 backfill 前对关系表加 SHARE 锁:
    // 阻塞并发写 (与 ROW EXCLUSIVE 冲突), 消除"绝对重算 backfill 覆盖触发器 +1"
    // 的竞态; 事务提交后自动释放锁, 计数最终与关系行一致
    await prisma.$transaction(
      async (tx) => {
        for (const stmt of TRIGGER_STATEMENTS) {
          await tx.$executeRawUnsafe(stmt)
        }
        await tx.$executeRawUnsafe(
          'LOCK TABLE "patch_tag_relation", "patch_company_relation" IN SHARE MODE'
        )
        await tx.$executeRawUnsafe(
          buildBackfillSql('patch_tag', 'tag_id', 'patch_tag_relation')
        )
        await tx.$executeRawUnsafe(
          buildBackfillSql(
            'patch_company',
            'company_id',
            'patch_company_relation'
          )
        )
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
