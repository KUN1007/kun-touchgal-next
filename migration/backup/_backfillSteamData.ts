// 一次性脚本：为「仅填写了 Steam ID 且发售时间为 unknown」的条目回填 Steam 数据
// 规则：与 /edit/rewrite 页「获取 Steam 数据」按钮同一逻辑 ——
//   released ← Steam releaseDate（Steam 返回为空则保持 unknown）；
//   日/英/繁三语言别名 trim 去空、剔除与标题相同者后增量写入；
//   tags 以 source=steam 建标签并关联、developers 建会社并关联
//   （复用提交端 processSubmittedExternalData，事务内同步写 search_outbox，
//   提交后失效详情缓存）
// 「仅填写了 Steam ID」= vndb_id / vndb_relation_id / bangumi_id / dlsite_code 均为空
// 用法：pnpm esno migration/backup/_backfillSteamData.ts [--dry-run] [--limit N]
//   --dry-run 只请求 Steam 并打印将写入的数据，不写库
//   --limit N 最多处理 N 条命中条目（生产先小批试跑用）
import { prisma } from '~/prisma/index'
import { fetchSteamAppData } from '~/lib/arnebiae/steam'
import { processSubmittedExternalData } from '~/app/api/edit/processExternalData'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'
import { drainSearchOutbox, enqueueSearchOutbox } from '~/server/search/sync'

const BATCH_SIZE = 500
const STEAM_FETCH_INTERVAL_MS = 2000
const isDryRun = process.argv.includes('--dry-run')
const limitArgIndex = process.argv.indexOf('--limit')
const limit =
  limitArgIndex !== -1 ? Number(process.argv[limitArgIndex + 1]) : Infinity

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const run = async () => {
  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error('--limit 需要一个正整数参数')
  }

  let scanned = 0
  let matched = 0
  let updatedReleased = 0
  let cursorId = 0
  const failed: { uniqueId: string; steamId: number }[] = []

  outer: for (;;) {
    const batch = await prisma.patch.findMany({
      where: {
        id: { gt: cursorId },
        steam_id: { not: null },
        released: 'unknown'
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      select: {
        id: true,
        unique_id: true,
        name: true,
        steam_id: true,
        user_id: true,
        vndb_id: true,
        vndb_relation_id: true,
        bangumi_id: true,
        dlsite_code: true
      }
    })
    if (!batch.length) {
      break
    }
    cursorId = batch[batch.length - 1].id
    scanned += batch.length

    for (const patch of batch) {
      // 空串与 null 都视作未填写，故在 JS 侧过滤而非 where 条件
      const steamOnly =
        !patch.vndb_id &&
        !patch.vndb_relation_id &&
        !patch.bangumi_id &&
        !patch.dlsite_code
      if (!steamOnly) {
        continue
      }
      if (matched >= limit) {
        console.log(`已达 --limit ${limit}，停止处理`)
        break outer
      }
      matched++

      const steamId = patch.steam_id!
      let data
      try {
        data = await fetchSteamAppData(steamId)
      } catch (error) {
        failed.push({ uniqueId: patch.unique_id, steamId })
        console.error(
          `[Steam 获取失败] ${patch.unique_id} (steam_id=${steamId}):`,
          error
        )
        await sleep(STEAM_FETCH_INTERVAL_MS)
        continue
      }
      await sleep(STEAM_FETCH_INTERVAL_MS)

      const extraAliases = [
        data.aliases.japanese,
        data.aliases.english,
        data.aliases.tchinese
      ]
        .map((a) => a?.trim())
        .filter((a): a is string => !!a)
        .filter((a) => a !== patch.name.trim())
      const steamDevelopers = data.developers.map((d) => d.name)
      const released = data.releaseDate || 'unknown'

      console.log(
        `${isDryRun ? '[dry-run 回填]' : '[回填]'} ${patch.unique_id} ` +
          `${JSON.stringify(patch.name)} (steam_id=${steamId}): ` +
          `released=${released}, 别名 ${extraAliases.length} 个, ` +
          `标签 ${data.tags.length} 个, 开发商 [${steamDevelopers.join(', ')}]`
      )
      if (isDryRun) {
        continue
      }

      if (released !== 'unknown') {
        await prisma.$transaction(async (tx) => {
          await tx.patch.update({
            where: { id: patch.id },
            data: { released }
          })
          await enqueueSearchOutbox(tx, patch.id)
        })
        updatedReleased++
      } else {
        // released 未变时标签 / 别名仍会改动搜索文档，独立入队
        await enqueueSearchOutbox(prisma, patch.id)
      }

      // 新建标签 / 会社的归属用户取条目创建者
      await processSubmittedExternalData(
        patch.id,
        {
          vndbTags: [],
          vndbDevelopers: [],
          bangumiTags: [],
          bangumiDevelopers: [],
          steamTags: data.tags,
          steamDevelopers,
          steamAliases: extraAliases,
          dlsiteCircleName: '',
          dlsiteCircleLink: ''
        },
        [],
        patch.user_id
      )

      await invalidatePatchContentCache(patch.unique_id).catch(
        (error: unknown) => {
          console.error(`[缓存失效失败] ${patch.unique_id}:`, error)
        }
      )
    }
    console.log(`已扫描 ${scanned} 条...`)
  }

  if (!isDryRun && matched > failed.length) {
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

  if (failed.length) {
    console.log(
      `\nSteam 获取失败 ${failed.length} 条（可重跑本脚本补齐）: ` +
        failed.map((f) => `${f.uniqueId}(${f.steamId})`).join(', ')
    )
  }
  console.log(
    `\n完成${isDryRun ? '（dry-run，未写库）' : ''}: ` +
      `扫描 ${scanned} 条候选（有 Steam ID 且 released=unknown），` +
      `命中 ${matched} 条仅填 Steam ID 的条目，` +
      `${isDryRun ? '' : `回填 released ${updatedReleased} 条，`}` +
      `Steam 获取失败 ${failed.length} 条`
  )
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
