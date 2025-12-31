import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'
import size from './size.json' with { type: 'json' }
import { prisma } from '~/prisma/index'

// 用户 ID, 根据生产环境的实际 uid 确定
const USER_ID = 1
// 处理文件最大并发数
const MAX_CONCURRENT = 70

// 文件夹路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MARKDOWN_DIR = path.join(__dirname, './markdown')
const FOLDERS = {
  SFW: 'SFW',
  NSFW: 'NSFW'
}

// 支持的分类
export const TYPE_MAP = {
  全部类型: 'all',
  PC游戏: 'pc',
  汉化资源: 'chinese',
  PE游戏: 'mobile',
  模拟器资源: 'emulator',
  生肉资源: 'row',
  直装资源: 'app',
  补丁资源: 'patch',
  游戏工具: 'tool',
  官方通知: 'notice',
  其它: 'other'
}

export const markdownToText = (markdown) => {
  return markdown
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^\s*(#{1,6})\s+(.*)/gm, '$2')
    .replace(/```[\s\S]*?```|`([^`]*)`/g, '$1')
    .replace(/^(-{3,}|\*{3,})$/gm, '')
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

// 处理 Markdown 文件
const processMarkdownFile = async (filePath, contentLimit) => {
  try {
    // 读取文件内容
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(fileContent)

    // 提取字段
    const uniqueId = data.abbrlink

    const type = data.categories?.flat() || []
    const language = determineLanguage(type)
    const platform = determinePlatform(type)

    if (type.includes('官方通知')) {
      console.log(`跳过官方通知类型文件: ${filePath}`)
      return { status: 'fulfilled' }
    }

    // 检查是否已存在
    const existPatch = await prisma.patch.findUnique({
      where: { unique_id: uniqueId }
    })
    if (!existPatch) {
      console.log(`未找到该游戏, 跳过该游戏: ${uniqueId}`)
      return { status: 'fulfilled' }
    }

    // 创建资源
    const note = extractNoteSection(content)
    await createPatchResources(
      content,
      existPatch.id,
      type,
      platform,
      language,
      note
    )

    console.log(`成功迁移文件: ${filePath}`)
  } catch (error) {
    console.error(`迁移文件失败: ${filePath}`, error)
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const processMarkdownFiles = async (filePaths, contentLimit) => {
  console.time('Total Processing Time')
  const results = []

  // 分批处理文件
  for (let i = 0; i < filePaths.length; i += MAX_CONCURRENT) {
    const batch = filePaths.slice(i, i + MAX_CONCURRENT)
    const batchResults = await Promise.allSettled(
      batch.map((filePath) => processMarkdownFile(filePath, contentLimit))
    )
    results.push(...batchResults)

    console.log(`已处理 ${i + 1} 个游戏, 休息 1s`)
    await sleep(1000)
  }

  // 统计结果
  const succeeded = results.filter((res) => res.status === 'fulfilled').length
  const failed = results.filter((res) => res.status === 'rejected').length

  console.log(`处理完成: 成功 ${succeeded} 个文件，失败 ${failed} 个文件`)
  console.timeEnd('Total Processing Time')
}

const processMarkdownDirectory = async (directoryPath, contentLimit) => {
  try {
    const allFiles = fs.readdirSync(directoryPath)
    const markdownFiles = allFiles.filter((file) => file.endsWith('.md'))
    const filePaths = markdownFiles.map((file) =>
      path.join(directoryPath, file)
    )

    console.log(`开始处理 ${filePaths.length} 个 Markdown 文件...`)
    await processMarkdownFiles(filePaths, contentLimit)
  } catch (error) {
    console.error('目录扫描或处理过程中出现错误:', error)
  }
}

// 工具函数
const determineLanguage = (type) => {
  if (type.includes('汉化资源')) return ['zh-Hans']
  if (type.includes('生肉资源')) return ['ja']
  return ['other']
}

const determinePlatform = (type) => {
  const platforms = []
  if (type.includes('PC游戏')) platforms.push('windows')
  if (type.some((t) => ['PE游戏', '模拟器资源', '直装资源'].includes(t))) {
    platforms.push('android')
  }
  return platforms.length ? platforms : ['other']
}

const mapTypes = (type) => type.map((t) => TYPE_MAP[t])

const extractNoteSection = (content) => {
  const match = content.match(/## ▼ 游戏备注\s*([\s\S]+?)$/)
  return match ? match[1].trim() : ''
}

const createPatchResources = async (
  content,
  patchId,
  type,
  platform,
  language,
  note
) => {
  const sections = [
    {
      marker: '## ▼ PE版下载链接',
      name: '手机版游戏本体下载资源',
      excludeType: new Set(['PC游戏']),
      excludePlatform: new Set(['windows'])
    },
    {
      marker: '## PE版下载链接',
      name: '手机版游戏本体下载资源',
      excludeType: new Set(['PC游戏']),
      excludePlatform: new Set(['windows'])
    },
    {
      marker: '## ▼ PE版下载地址',
      name: '手机版游戏本体下载资源',
      excludeType: new Set(['PC游戏']),
      excludePlatform: new Set(['windows'])
    }
  ]

  await Promise.all(
    sections.map(async (section) => {
      const regex = new RegExp(`${section.marker}\\s*\\{\\% btn '(.+?)',`, 's')
      const match = content.match(regex)

      if (match) {
        const link = match[1]
        const excludedType = type.filter((t) => !section.excludeType.has(t))
        const excludedPlatform = platform.filter(
          (p) => !section.excludePlatform.has(p)
        )

        const resource = await prisma.patch_resource.findFirst({
          where: { content: link }
        })
        if (resource) {
          console.log('检测到已添加过的手机资源, 自动跳过')
          return
        }

        await createPatchResource(
          {
            patchId,
            section: 'galgame',
            name: section.name,
            storage: 'touchgal',
            size: size[link] ?? '未知大小',
            content: link,
            type: mapTypes(excludedType),
            language,
            platform: excludedPlatform,
            note: markdownToText(note)
          },
          USER_ID
        )
      }
    })
  )
}

// 创建资源
const createPatchResource = async (input, uid) => {
  const {
    patchId,
    type,
    language,
    platform,
    content,
    storage,
    ...resourceData
  } = input

  await prisma.patch_resource.create({
    data: {
      patch_id: patchId,
      user_id: uid,
      type,
      language,
      platform,
      content,
      storage,
      ...resourceData
    }
  })
}

// 主函数
const kun = async () => {
  try {
    // 处理 SFW 文件夹
    const sfwPath = path.join(MARKDOWN_DIR, FOLDERS.SFW)
    if (fs.existsSync(sfwPath)) {
      console.log('开始处理 SFW 文件夹...')
      await processMarkdownDirectory(sfwPath, 'sfw')
    }

    // 处理 NSFW 文件夹
    const nsfwPath = path.join(MARKDOWN_DIR, FOLDERS.NSFW)
    if (fs.existsSync(nsfwPath)) {
      console.log('开始处理 NSFW 文件夹...')
      await processMarkdownDirectory(nsfwPath, 'nsfw')
    }

    console.log('迁移完成！')
  } catch (error) {
    console.error('迁移过程中出现错误: ', error)
  } finally {
    await prisma.$disconnect()
  }
}

kun()
