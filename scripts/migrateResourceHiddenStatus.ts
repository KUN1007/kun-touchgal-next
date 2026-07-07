import { prisma } from '~/prisma/index'

// 一次性迁移: 将旧管理隐藏语义的 patch_resource.status 从 1 迁到 3。
//
// 背景: 旧版本 status=1 表示 "对所有人隐藏"; 新版本 status=1 被重定义为
// "shadow ban (作者可见)", status=3 才是 "对所有人隐藏 (仅 /admin 可管理)"。
// 若不迁移, 部署新代码后旧的被管理员隐藏的资源会对其上传者重新可见 (带下载链接)。
//
// !!! 时序要求: 必须在新代码产生任何真实 shadow ban (status=1) 之前运行。
//     新代码写 status=1 的位置: moderation 拦截 (app/api/patch/resource/update.ts)
//     与管理端 "屏蔽" 动作 (app/api/admin/resource/hidden/hidden.ts)。
//     生产此刻仍是旧版本时运行最安全 —— 那时所有 status=1 都是旧隐藏资源。
//
// 默认 dry-run, 仅打印将要变更的行数; 加 --apply 才真正写库。
//   pnpm exec esno scripts/migrateResourceHiddenStatus.ts            # 预演
//   pnpm exec esno scripts/migrateResourceHiddenStatus.ts --apply    # 执行

const OLD_HIDDEN_STATUS = 1
const NEW_HIDDEN_STATUS = 3

const migrate = async () => {
  const apply = process.argv.includes('--apply')

  const distribution = await prisma.patch_resource.groupBy({
    by: ['status'],
    _count: true,
    orderBy: { status: 'asc' }
  })
  console.log('[migrate] 当前 status 分布:')
  for (const row of distribution) {
    console.log(`  status=${row.status}: ${row._count}`)
  }

  const target = await prisma.patch_resource.count({
    where: { status: OLD_HIDDEN_STATUS }
  })
  console.log(
    `[migrate] 待迁移 status=${OLD_HIDDEN_STATUS} -> ${NEW_HIDDEN_STATUS}: ${target} 行`
  )

  if (target === 0) {
    console.log('[migrate] 无需迁移。')
    return
  }

  if (!apply) {
    console.log('[migrate] dry-run: 未写库。确认无误后加 --apply 重新运行。')
    return
  }

  const result = await prisma.patch_resource.updateMany({
    where: { status: OLD_HIDDEN_STATUS },
    data: { status: NEW_HIDDEN_STATUS }
  })
  console.log(`[migrate] 已更新 ${result.count} 行。`)

  const remaining = await prisma.patch_resource.count({
    where: { status: OLD_HIDDEN_STATUS }
  })
  console.log(
    `[migrate] 校验: status=${OLD_HIDDEN_STATUS} 剩余 ${remaining} 行 (理应为 0; 若非 0 说明运行期间有新 status=1 写入, 请核对上线时序)。`
  )
}

migrate()
  .catch((error) => {
    console.error('[migrate] fatal:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
