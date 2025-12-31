import { prisma } from '~/prisma/index'
import { writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  try {
    const patches = await prisma.patch.findMany({
      where: {
        alias: {
          isEmpty: false
        }
      },
      select: {
        id: true,
        alias: true
      }
    })

    const result = patches.flatMap((patch) =>
      patch.alias.map((alias) => ({
        id: patch.id,
        alias
      }))
    )

    await writeFile(
      `${__dirname}/patches.json`,
      JSON.stringify(result, null, 2)
    )

    console.log(`数据已成功写入 ${__dirname}/patches.json`)
  } catch (error) {
    console.error('发生错误:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
