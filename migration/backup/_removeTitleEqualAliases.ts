// 一次性脚本：删除与游戏标题完全相同的别名
// 规则：遍历所有游戏条目，将标题与该条目全部别名逐一对比（两侧 trim 后完全匹配），
//   命中的别名直接删除（事务内同步写 search_outbox，提交后失效详情缓存）
// 用法：pnpm esno migration/backup/_removeTitleEqualAliases.ts [--dry-run]
//   --dry-run 只扫描与输出清单，不写库
import { prisma } from '~/prisma/index'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'
import { drainSearchOutbox, enqueueSearchOutbox } from '~/server/search/sync'

const BATCH_SIZE = 500
const isDryRun = process.argv.includes('--dry-run')

const run = async () => {
  let scanned = 0
  let affectedPatches = 0
  let removedAliases = 0
  let cursorId = 0

  for (;;) {
    const batch = await prisma.patch.findMany({
      where: { id: { gt: cursorId }, alias: { some: {} } },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      select: {
        id: true,
        unique_id: true,
        name: true,
        alias: { select: { id: true, name: true } }
      }
    })
    if (!batch.length) {
      break
    }
    cursorId = batch[batch.length - 1].id
    scanned += batch.length

    for (const patch of batch) {
      const title = patch.name.trim()
      const duplicated = patch.alias.filter((a) => a.name.trim() === title)
      if (!duplicated.length) {
        continue
      }

      affectedPatches++
      removedAliases += duplicated.length
      console.log(
        `${isDryRun ? '[dry-run 删除]' : '[删除]'} ${patch.unique_id} ` +
          `${JSON.stringify(patch.name)}: 同名别名 ${duplicated.length} 条`
      )
      if (isDryRun) {
        continue
      }

      await prisma.$transaction(async (tx) => {
        await tx.patch_alias.deleteMany({
          where: { id: { in: duplicated.map((a) => a.id) } }
        })
        await enqueueSearchOutbox(tx, patch.id)
      })
      await invalidatePatchContentCache(patch.unique_id).catch(
        (error: unknown) => {
          console.error(`[缓存失效失败] ${patch.unique_id}:`, error)
        }
      )
    }
    console.log(`已扫描 ${scanned} 条...`)
  }

  if (!isDryRun && removedAliases > 0) {
    // 写出箱单轮最多消费 200 行，循环 drain 至清空；未配 Meili 或不再减少时退出，
    // 剩余行由应用的定时任务兜底
    let prev = Infinity
    for (;;) {
      const remaining = await prisma.search_outbox.count()
      if (remaining === 0 || remaining >= prev) {
        break
      }
      prev = remaining
      await drainSearchOutbox()
    }
  }

  console.log(
    `\n完成${isDryRun ? '（dry-run，未写库）' : ''}: ` +
      `扫描 ${scanned} 条含别名条目，${affectedPatches} 条存在同名别名，` +
      `删除 ${removedAliases} 条别名`
  )
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
