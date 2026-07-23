// 一次性脚本：清理「标题1 - 标题2」格式的游戏标题
// 规则：以 " - " 为分隔符拆出标题2，与该条目的所有别名做完全匹配（两侧 trim）——
//   1. 命中别名 → 标题改为仅保留标题1（事务内同步写 search_outbox，提交后失效详情缓存）
//   2. 未命中 → 不改动，记录到 scripts/stripDuplicateSubtitle.unmatched.json 供人工复核
// 用法：pnpm esno scripts/stripDuplicateSubtitle.ts [--dry-run]
//   --dry-run 只扫描与输出清单，不写库
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { prisma } from '~/prisma/index'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'
import { drainSearchOutbox, enqueueSearchOutbox } from '~/server/search/sync'

const SEPARATOR = ' - '
const BATCH_SIZE = 500
const OUTPUT_FILE = path.resolve(
  process.cwd(),
  'scripts/stripDuplicateSubtitle.unmatched.json'
)
const isDryRun = process.argv.includes('--dry-run')

interface UnmatchedRecord {
  id: number
  unique_id: string
  name: string
  candidates: string[]
  aliases: string[]
}

const run = async () => {
  const unmatched: UnmatchedRecord[] = []
  let renamed = 0
  let scanned = 0
  let cursorId = 0

  for (;;) {
    const batch = await prisma.patch.findMany({
      where: { id: { gt: cursorId } },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      select: {
        id: true,
        unique_id: true,
        name: true,
        alias: { select: { name: true } }
      }
    })
    if (!batch.length) {
      break
    }
    cursorId = batch[batch.length - 1].id
    scanned += batch.length

    for (const patch of batch) {
      // 标题1 内部可能自带连字符（如「战巫 -污秽的契约与神之衣-」），无法只按首个
      // 分隔符拆；从左到右逐个 " - " 尝试，使标题2 尽可能长（别名通常是完整原文标题）
      const splits: { title1: string; title2: string }[] = []
      let idx = patch.name.indexOf(SEPARATOR)
      while (idx !== -1) {
        const title1 = patch.name.slice(0, idx).trim()
        const title2 = patch.name.slice(idx + SEPARATOR.length).trim()
        if (title1 && title2) {
          splits.push({ title1, title2 })
        }
        idx = patch.name.indexOf(SEPARATOR, idx + 1)
      }
      if (!splits.length) {
        continue
      }

      const aliases = patch.alias.map((a) => a.name.trim())
      const aliasSet = new Set(aliases)
      const hit = splits.find((s) => aliasSet.has(s.title2))

      if (!hit) {
        unmatched.push({
          id: patch.id,
          unique_id: patch.unique_id,
          name: patch.name,
          candidates: splits.map((s) => s.title2),
          aliases
        })
        continue
      }

      renamed++
      console.log(
        `${isDryRun ? '[dry-run 改名]' : '[改名]'} ${patch.unique_id}: ` +
          `${JSON.stringify(patch.name)} -> ${JSON.stringify(hit.title1)}`
      )
      if (isDryRun) {
        continue
      }

      await prisma.$transaction(async (tx) => {
        await tx.patch.update({
          where: { id: patch.id },
          data: { name: hit.title1 }
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

  writeFileSync(OUTPUT_FILE, JSON.stringify(unmatched, null, 2) + '\n')

  if (!isDryRun && renamed > 0) {
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
      `扫描 ${scanned} 条，改名 ${renamed} 条，未匹配记录 ${unmatched.length} 条`
  )
  console.log(`未匹配清单已写入 ${OUTPUT_FILE}`)
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
