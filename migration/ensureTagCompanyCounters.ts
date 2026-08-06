import 'dotenv/config'
import { prisma } from '~/prisma/index'

// patch_tag.count / patch_company.count 由关系表行数驱动:
// 关系行随 patch 级联删除 / user 级联删除 / 显式解绑消失时同步递减, 插入时递增。
// 语句级触发器 + transition table: 级联删除的每条内部 DELETE 同样触发, 删除侧不漏减;
// ON CONFLICT 未实插的行不进 transition 表, 并发重复 increment 口子一并关闭。
// 不用行级触发器: 行级版的父表行锁顺序 = 调用方数组顺序, 各 createMany 调用点
// 顺序互不一致(请求体 / 无 orderBy 的 findMany / 外部 API), 并发反序插入即死锁。
// 函数内必须 FOR 循环逐 id 升序点查更新 —— ORDER BY + FOR UPDATE 的加锁顺序由
// 执行计划决定, 不保证有序; 也不得显式 FOR UPDATE: 它与并发 INSERT 经外键 RI 检查
// 对父行持有的 FOR KEY SHARE 冲突, UPDATE count 自带的 FOR NO KEY UPDATE 才相容。
// 上线顺序: 先部署拆除应用层手工计数的代码, 再跑本脚本 —— 窗口期漏计由
// 同事务的全量 backfill 一并修正; 顺序颠倒则窗口期双计且无法自愈。

// 无 status 的纯关系表: 父表 count 只随关系行增删迁移。
// 引用 transition 表的触发器不能挂 INSERT OR DELETE 合体, 按事件拆三个
const buildRelationCounterTrigger = (
  name: string,
  parentTable: string,
  fkColumn: string,
  relationTable: string
): string[] => [
  // 已装过旧行级版的库: 先摘旧触发器与旧函数再装新版
  `DROP TRIGGER IF EXISTS ${name} ON "${relationTable}"`,
  `DROP FUNCTION IF EXISTS ${name}()`,
  `
CREATE OR REPLACE FUNCTION ${name}_ins() RETURNS trigger AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT ${fkColumn} AS fk, COUNT(*)::int AS c
    FROM new_rows GROUP BY ${fkColumn} ORDER BY ${fkColumn}
  LOOP
    UPDATE "${parentTable}" SET count = count + r.c WHERE id = r.fk;
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql
`,
  `
CREATE OR REPLACE FUNCTION ${name}_del() RETURNS trigger AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT ${fkColumn} AS fk, COUNT(*)::int AS c
    FROM old_rows GROUP BY ${fkColumn} ORDER BY ${fkColumn}
  LOOP
    UPDATE "${parentTable}" SET count = GREATEST(count - r.c, 0) WHERE id = r.fk;
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql
`,
  `
CREATE OR REPLACE FUNCTION ${name}_upd() RETURNS trigger AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT fk, SUM(delta)::int AS c
    FROM (
      SELECT o.${fkColumn} AS fk, -1 AS delta
      FROM old_rows o JOIN new_rows n USING (id)
      WHERE o.${fkColumn} IS DISTINCT FROM n.${fkColumn}
      UNION ALL
      SELECT n.${fkColumn}, 1
      FROM old_rows o JOIN new_rows n USING (id)
      WHERE o.${fkColumn} IS DISTINCT FROM n.${fkColumn}
    ) s
    GROUP BY fk ORDER BY fk
  LOOP
    UPDATE "${parentTable}" SET count = GREATEST(count + r.c, 0) WHERE id = r.fk;
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql
`,
  `DROP TRIGGER IF EXISTS ${name}_ins ON "${relationTable}"`,
  `
CREATE TRIGGER ${name}_ins
AFTER INSERT ON "${relationTable}"
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION ${name}_ins()
`,
  `DROP TRIGGER IF EXISTS ${name}_del ON "${relationTable}"`,
  `
CREATE TRIGGER ${name}_del
AFTER DELETE ON "${relationTable}"
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION ${name}_del()
`,
  `DROP TRIGGER IF EXISTS ${name}_upd ON "${relationTable}"`,
  // 带列列表 (UPDATE OF) 的触发器不能用 transition 表, 改由函数内 IS DISTINCT FROM 过滤
  `
CREATE TRIGGER ${name}_upd
AFTER UPDATE ON "${relationTable}"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION ${name}_upd()
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
