// 一次性脚本：为「外部 ID 全空、但介绍中带 DLsite 购买链接」的条目回填 dlsite_code 并获取 DLsite 数据
// 命中条件：vndb_id / vndb_relation_id / bangumi_id / steam_id / dlsite_code 均为空，
//   且 introduction 含「## 支持正版」区块与指向 dlsite.com 的 ::kun-link，
//   从 href 的 product_id/ 段提取 RJ/VJ 号（站点段 maniax / pro / soft / girls / appx 等不固定，
//   work 与 announce 页、有无 .html / query 参数均兼容；ci-en.dlsite.com 创作者页无 RJ/VJ 号，跳过）
// 回填规则：与 /edit/rewrite 页「获取 DLsite 数据」按钮同一逻辑 ——
//   dlsite_code ← 链接中的 RJ/VJ 号；
//   released ← DLsite release_date（返回为空则保持原值；与按钮一致，非空会覆盖已填值，dry-run 可先审查）；
//   日/英标题 trim 去空、剔除与标题相同者后增量写入别名；
//   tags 与按钮相同走用户标签通道（新建 source=self）——按钮是「并入表单现有标签后全量提交」，
//   故此处先读现有标签合并，避免 handleBatchPatchTags 的全量同步语义删除现有标签；
//   circle 建会社（带官网链接）并关联
//   （复用提交端 processSubmittedExternalData，事务内同步写 search_outbox，提交后失效详情缓存）
// 链接清理：提取出 code 的 dlsite 链接同时去掉末尾 query 参数（….html/?locale=zh_CN → ….html）；
//   code 冲突条目不写 code 但链接同样清理
// 跳过并记录：无法提取 code（如 ci-en）、单条介绍多个不同 code、code 已被其他条目占用
// DLsite 获取失败（作品可能已下架）仍写入 dlsite_code，失败列表打印供人工到 rewrite 页补齐
// 运行结束将「code 冲突」与「仅填 code」两类需人工处理的条目写入同目录
// backfillDlsiteFromIntro.report.md（注意：报告只反映当次运行——仅填 code 的条目
// 因 dlsite_code 已写库，重跑不再命中，勿用重跑产物覆盖旧报告后丢失该清单）
// 用法：pnpm esno scripts/backfillDlsiteFromIntro.ts [--dry-run] [--limit N]
//   --dry-run 只提取并请求 DLsite、打印将写入的数据，不写库（报告仍会写出，标注 dry-run）
//   --limit N 最多处理 N 条提取到 code 的条目（生产先小批试跑用）
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { prisma } from '~/prisma/index'
import { fetchDlsiteData } from '~/lib/arnebiae/dlsite'
import { processSubmittedExternalData } from '~/app/api/edit/processExternalData'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'
import { drainSearchOutbox, enqueueSearchOutbox } from '~/server/search/sync'
import {
  normalizeStringArray,
  parseCommaSeparatedStringArray
} from '~/utils/normalizeStringArray'

const BATCH_SIZE = 500
const DLSITE_FETCH_INTERVAL_MS = 2000
const isDryRun = process.argv.includes('--dry-run')
const limitArgIndex = process.argv.indexOf('--limit')
const limit =
  limitArgIndex !== -1 ? Number(process.argv[limitArgIndex + 1]) : Infinity

const KUN_LINK_HREF_RE = /::kun-link\{[^}]*?href="([^"]*)"[^}]*?\}/g
const PRODUCT_ID_RE = /\/product_id\/((?:RJ|VJ)\d+)/i

type ExtractResult =
  | { kind: 'ok'; code: string }
  | { kind: 'none' }
  | { kind: 'ambiguous'; codes: string[] }

const extractDlsiteCode = (introduction: string): ExtractResult => {
  if (!introduction.includes('## 支持正版')) {
    return { kind: 'none' }
  }
  const codes = new Set<string>()
  for (const match of introduction.matchAll(KUN_LINK_HREF_RE)) {
    const href = match[1]
    if (!/dlsite\.com/i.test(href)) continue
    const codeMatch = href.match(PRODUCT_ID_RE)
    if (codeMatch) {
      codes.add(codeMatch[1].toUpperCase())
    }
  }
  if (!codes.size) return { kind: 'none' }
  if (codes.size > 1) return { kind: 'ambiguous', codes: [...codes] }
  return { kind: 'ok', code: [...codes][0] }
}

// 去掉链接末尾的 query 参数及其紧邻的悬空斜杠：….html/?locale=zh_CN → ….html
const stripHrefQuery = (href: string) => href.replace(/\/?\?.*$/, '')

// 只清理提取出 code 的那类链接（dlsite.com 且含 product_id 的 kun-link href），
// ci-en 等其他链接不动
const cleanDlsiteLinkQuery = (introduction: string) =>
  introduction.replace(KUN_LINK_HREF_RE, (full, href: string) => {
    if (!/dlsite\.com/i.test(href) || !PRODUCT_ID_RE.test(href)) return full
    const stripped = stripHrefQuery(href)
    if (stripped === href) return full
    return full.replace(`href="${href}"`, `href="${stripped}"`)
  })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// code 冲突分支的写入：仅清理介绍链接，不动 code
const persistIntroCleanup = async (
  patchId: number,
  uniqueId: string,
  cleanedIntroduction: string
) => {
  await prisma.$transaction(async (tx) => {
    await tx.patch.update({
      where: { id: patchId },
      data: { introduction: cleanedIntroduction }
    })
    await enqueueSearchOutbox(tx, patchId)
  })
  await invalidatePatchContentCache(uniqueId).catch((error: unknown) => {
    console.error(`[缓存失效失败] ${uniqueId}:`, error)
  })
}

const run = async () => {
  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error('--limit 需要一个正整数参数')
  }

  let scanned = 0
  let matched = 0
  let updated = 0
  let updatedReleased = 0
  let codeOnly = 0
  let cleanedLink = 0
  let skippedNoCode = 0
  let cursorId = 0
  const ambiguous: { uniqueId: string; codes: string[] }[] = []
  const conflicts: {
    uniqueId: string
    name: string
    code: string
    takenBy: string
  }[] = []
  const failedFetch: { uniqueId: string; name: string; code: string }[] = []
  const failedWrite: { uniqueId: string; code: string }[] = []

  outer: for (;;) {
    const batch = await prisma.patch.findMany({
      where: {
        id: { gt: cursorId },
        bangumi_id: null,
        steam_id: null,
        introduction: { contains: 'dlsite.com', mode: 'insensitive' }
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      select: {
        id: true,
        unique_id: true,
        name: true,
        introduction: true,
        released: true,
        user_id: true,
        vndb_id: true,
        vndb_relation_id: true,
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
      const noExternalIds =
        !patch.vndb_id && !patch.vndb_relation_id && !patch.dlsite_code
      if (!noExternalIds) {
        continue
      }

      const extracted = extractDlsiteCode(patch.introduction)
      if (extracted.kind === 'none') {
        skippedNoCode++
        continue
      }
      if (extracted.kind === 'ambiguous') {
        ambiguous.push({ uniqueId: patch.unique_id, codes: extracted.codes })
        continue
      }
      const code = extracted.code
      const cleanedIntroduction = cleanDlsiteLinkQuery(patch.introduction)
      const introChanged = cleanedIntroduction !== patch.introduction

      if (matched >= limit) {
        console.log(`已达 --limit ${limit}，停止处理`)
        break outer
      }
      matched++

      // dlsite_code 唯一约束预检；逐条查询使前序已写入的 code 也能挡住批内重复
      const taken = await prisma.patch.findFirst({
        where: { dlsite_code: code },
        select: { unique_id: true }
      })
      if (taken) {
        conflicts.push({
          uniqueId: patch.unique_id,
          name: patch.name,
          code,
          takenBy: taken.unique_id
        })
        console.log(
          `[跳过·code 冲突] ${patch.unique_id} 的 ${code} 已被 ${taken.unique_id} 占用` +
            `${introChanged ? '（链接 query 仍清理）' : ''}`
        )
        if (introChanged) {
          if (isDryRun) {
            cleanedLink++
          } else {
            try {
              await persistIntroCleanup(
                patch.id,
                patch.unique_id,
                cleanedIntroduction
              )
              cleanedLink++
            } catch (error) {
              failedWrite.push({ uniqueId: patch.unique_id, code })
              console.error(`[写入失败] ${patch.unique_id} (${code}):`, error)
            }
          }
        }
        continue
      }

      let data
      try {
        const result = await fetchDlsiteData(code)
        // 与按钮一致：无 title_default 视作未找到数据
        data = result?.title_default ? result : null
      } catch {
        data = null
      }
      await sleep(DLSITE_FETCH_INTERVAL_MS)

      if (!data) {
        // 作品可能已下架：code 本身仍有效，只填 code，其余信息人工补齐
        failedFetch.push({ uniqueId: patch.unique_id, name: patch.name, code })
        console.log(
          `${isDryRun ? '[dry-run 仅填 code]' : '[仅填 code]'} ${patch.unique_id} ` +
            `${JSON.stringify(patch.name)}: ${code}（DLsite 获取失败）` +
            `${introChanged ? '，清理链接参数' : ''}`
        )
        if (isDryRun) {
          continue
        }
        try {
          await prisma.$transaction(async (tx) => {
            await tx.patch.update({
              where: { id: patch.id },
              data: { dlsite_code: code, introduction: cleanedIntroduction }
            })
            await enqueueSearchOutbox(tx, patch.id)
          })
          codeOnly++
        } catch (error) {
          failedWrite.push({ uniqueId: patch.unique_id, code })
          console.error(`[写入失败] ${patch.unique_id} (${code}):`, error)
          continue
        }
        await invalidatePatchContentCache(patch.unique_id).catch(
          (error: unknown) => {
            console.error(`[缓存失效失败] ${patch.unique_id}:`, error)
          }
        )
        continue
      }

      // 以下字段组装与 rewrite 页按钮完全一致
      const extraAliases = normalizeStringArray([
        data.title_jp,
        data.title_en
      ]).filter((a) => a !== patch.name.trim())
      const parsedTags = parseCommaSeparatedStringArray(data.tags ?? '')
      const circleName = data.circle_name?.trim() ?? ''
      const circleLink = data.circle_link?.trim() ?? ''
      const released = data.release_date || patch.released

      console.log(
        `${isDryRun ? '[dry-run 回填]' : '[回填]'} ${patch.unique_id} ` +
          `${JSON.stringify(patch.name)}: ${code}, ` +
          `released=${released}` +
          `${released !== patch.released ? `（覆盖原值 ${patch.released}）` : ''}, ` +
          `别名 ${extraAliases.length} 个, 标签 ${parsedTags.length} 个, ` +
          `社团 ${JSON.stringify(circleName)}` +
          `${introChanged ? '，清理链接参数' : ''}`
      )
      if (isDryRun) {
        continue
      }

      try {
        await prisma.$transaction(async (tx) => {
          await tx.patch.update({
            where: { id: patch.id },
            data: {
              dlsite_code: code,
              released,
              introduction: cleanedIntroduction
            }
          })
          await enqueueSearchOutbox(tx, patch.id)
        })

        // 按钮将 DLsite 标签并入表单现有标签后全量提交，此处等价：读现有标签合并
        let userTags: string[] = []
        if (parsedTags.length) {
          const existingRelations = await prisma.patch_tag_relation.findMany({
            where: { patch_id: patch.id },
            select: { tag: { select: { name: true } } }
          })
          userTags = normalizeStringArray([
            ...existingRelations.map((r) => r.tag.name),
            ...parsedTags
          ])
        }

        // 新建标签 / 会社的归属用户取条目创建者
        await processSubmittedExternalData(
          patch.id,
          {
            vndbTags: [],
            vndbDevelopers: [],
            bangumiTags: [],
            bangumiDevelopers: [],
            steamTags: [],
            steamDevelopers: [],
            steamAliases: extraAliases,
            dlsiteCircleName: circleName,
            dlsiteCircleLink: circleLink
          },
          userTags,
          patch.user_id
        )
        updated++
        if (released !== patch.released) {
          updatedReleased++
        }
      } catch (error) {
        failedWrite.push({ uniqueId: patch.unique_id, code })
        console.error(`[写入失败] ${patch.unique_id} (${code}):`, error)
        continue
      }

      await invalidatePatchContentCache(patch.unique_id).catch(
        (error: unknown) => {
          console.error(`[缓存失效失败] ${patch.unique_id}:`, error)
        }
      )
    }
    console.log(`已扫描 ${scanned} 条...`)
  }

  if (!isDryRun && (updated > 0 || codeOnly > 0 || cleanedLink > 0)) {
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

  if (ambiguous.length) {
    console.log(
      `\n单条介绍含多个不同 code，需人工确认 ${ambiguous.length} 条: ` +
        ambiguous.map((a) => `${a.uniqueId}[${a.codes.join('/')}]`).join(', ')
    )
  }
  if (conflicts.length) {
    console.log(
      `\ncode 已被其他条目占用（疑似重复条目），需人工确认 ${conflicts.length} 条: ` +
        conflicts.map((c) => `${c.uniqueId}(${c.code}→${c.takenBy})`).join(', ')
    )
  }
  if (failedFetch.length) {
    console.log(
      `\nDLsite 获取失败、仅回填 code ${failedFetch.length} 条` +
        `（可到 /edit/rewrite 页人工获取补齐）: ` +
        failedFetch.map((f) => `${f.uniqueId}(${f.code})`).join(', ')
    )
  }
  if (failedWrite.length) {
    console.log(
      `\n写入失败 ${failedWrite.length} 条（可重跑本脚本补齐）: ` +
        failedWrite.map((f) => `${f.uniqueId}(${f.code})`).join(', ')
    )
  }
  console.log(
    `\n完成${isDryRun ? '（dry-run，未写库）' : ''}: ` +
      `扫描 ${scanned} 条候选（介绍含 dlsite.com 且无 bangumi/steam ID），` +
      `提取到 code ${matched} 条，` +
      `无法提取 ${skippedNoCode} 条（含 ci-en 等无 RJ/VJ 号链接），` +
      `歧义 ${ambiguous.length} 条，code 冲突 ${conflicts.length} 条，` +
      `${isDryRun ? '' : `完整回填 ${updated} 条（其中覆盖 released ${updatedReleased} 条），仅填 code ${codeOnly} 条，`}` +
      `冲突条目仅清理链接 ${cleanedLink} 条，` +
      `DLsite 获取失败 ${failedFetch.length} 条，写入失败 ${failedWrite.length} 条`
  )

  const mdCell = (value: string) =>
    value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
  const reportPath = fileURLToPath(
    new URL('./backfillDlsiteFromIntro.report.md', import.meta.url)
  )
  const report = [
    '# DLsite 回填人工处理清单',
    '',
    `> 由 \`scripts/backfillDlsiteFromIntro.ts\` 于 ${new Date().toISOString()} 生成` +
      `${isDryRun ? '（dry-run，未写库）' : ''}，条目详情页路由为 \`/{条目 ID}\``,
    '',
    `## code 已被其他条目占用：${conflicts.length} 条`,
    '',
    '疑似重复条目，需人工确认是否合并。',
    '',
    ...(conflicts.length
      ? [
          '| 条目 ID | 名称 | 提取的 code | 已占用该 code 的条目 |',
          '| --- | --- | --- | --- |',
          ...conflicts.map(
            (c) =>
              `| ${c.uniqueId} | ${mdCell(c.name)} | ${c.code} | ${c.takenBy} |`
          )
        ]
      : ['无']),
    '',
    `## DLsite 获取失败、仅回填 code：${failedFetch.length} 条`,
    '',
    '作品可能已从 DLsite 下架，可到 `/edit/rewrite` 页人工获取补齐其余信息。',
    '',
    ...(failedFetch.length
      ? [
          '| 条目 ID | 名称 | code |',
          '| --- | --- | --- |',
          ...failedFetch.map(
            (f) => `| ${f.uniqueId} | ${mdCell(f.name)} | ${f.code} |`
          )
        ]
      : ['无']),
    ''
  ].join('\n')
  writeFileSync(reportPath, report)
  console.log(`人工处理清单已写入 ${reportPath}`)
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
