import { prisma } from '~/prisma/index'
import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  try {
    const filePath = `${__dirname}/patches.json`
    const data = await readFile(filePath, 'utf-8')
    const patches = JSON.parse(data)

    console.log(`开始迁移 ${patches.length} 条 alias 数据...`)

    for (const { id, alias } of patches) {
      await prisma.patch_alias.create({
        data: {
          name: alias,
          patch: {
            connect: { id: id }
          }
        }
      })
    }

    console.log('数据迁移完成！')
  } catch (error) {
    console.error('数据迁移失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
