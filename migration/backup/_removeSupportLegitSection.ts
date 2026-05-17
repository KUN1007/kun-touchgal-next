import 'dotenv/config'
import { prisma } from '~/prisma/index'

const PATTERN =
  /(?:\r?\n)*[ \t]*##[ \t]+支持正版[ \t]*\r?\n[ \t]*\r?\n[ \t]*暂无购买渠道[,，]游戏官网可能需要代理打开[ \t]*(?:\r?\n)?/g

const stripSection = (content: string): string => {
  const replaced = content.replace(PATTERN, '\n\n')
  return replaced.replace(/\n{3,}/g, '\n\n').replace(/\s+$/g, '')
}

const run = async () => {
  const patches = await prisma.patch.findMany({
    where: {
      AND: [
        { introduction: { contains: '## 支持正版' } },
        { introduction: { contains: '暂无购买渠道' } },
        { introduction: { contains: '游戏官网可能需要代理打开' } }
      ]
    },
    select: { id: true, unique_id: true, introduction: true }
  })

  console.log(`找到 ${patches.length} 个同时含有两段目标文本的 patch`)

  let updated = 0
  let unchanged = 0
  for (const patch of patches) {
    const next = stripSection(patch.introduction)
    if (next === patch.introduction) {
      unchanged++
      continue
    }
    await prisma.patch.update({
      where: { id: patch.id },
      data: { introduction: next }
    })
    updated++
    console.log(`  已更新 patch ${patch.unique_id} (id=${patch.id})`)
  }

  console.log(`\n完成: 更新 ${updated} 条, 未匹配 ${unchanged} 条`)
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
