import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'
import size from './size.json' with { type: 'json' }
import { uploadImageFromURL } from './_uploadBanner.mjs'
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
    const banner = data.cover || ''
    const created = new Date(data.date).toISOString()
    const title = data.title ?? ''
    const name = title.replace(/【.*?】/g, '').trim()
    const tags = data.tags || []

    const type = data.categories?.flat() || []
    const language = determineLanguage(type)
    const platform = determinePlatform(type)

    if (type.includes('官方通知')) {
      console.log(`跳过官方通知类型文件: ${filePath}`)
      return { status: 'fulfilled' }
    }

    // 处理 introduction
    const introduction = extractIntroduction(content, contentLimit)

    // 检查是否已存在
    const existPatch = await prisma.patch.findUnique({
      where: { unique_id: uniqueId }
    })
    if (existPatch) {
      console.log('发现重复的游戏: ', existPatch.name)
      console.log('跳过该游戏')
      return { status: 'fulfilled' }
    }

    // 创建 Patch 记录
    const patch = await prisma.patch.create({
      data: {
        unique_id: uniqueId,
        name,
        type: mapTypes(type),
        banner,
        content_limit: contentLimit,
        created,
        introduction,
        user_id: USER_ID,
        language,
        platform
      }
    })

    // 上传 Banner 并更新记录
    const bannerLink = await uploadImageFromURL(banner, patch.id)
    console.log(bannerLink)

    await prisma.patch.update({
      where: { id: patch.id },
      data: { banner: bannerLink }
    })

    // 创建标签并建立关联
    await createAndLinkTags(tags, patch.id)

    // 创建资源
    const note = extractNoteSection(content)
    await createPatchResources(content, patch, type, platform, language, note)

    console.log(`成功迁移文件: ${filePath}`)
  } catch (error) {
    console.error(`迁移文件失败: ${filePath}`, error)
  }
}

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

const extractIntroduction = (content, contentLimit) => {
  const sections = [
    '## ▼ 游戏介绍',
    '## ▼ 游戏截图',
    '## ▼ PV鉴赏',
    '## ▼ 支持正版'
  ]

  const tipRegex = /\{\% tip info \%\}([\s\S]*?)\{\% endtip \%\}/
  const tipMatch = content.match(tipRegex)
  const tipText = tipMatch ? tipMatch[1].trim() : ''

  // 去除 {% tip info %} 块
  content = content.replace(tipRegex, '').trim()

  let result = sections
    .map((section) => {
      const regex = new RegExp(`${section}\\s*([\\s\\S]*?)(?=\\n## \\▼|$)`, 'g')
      const match = content.match(regex)
      return match ? match.join('\n\n').trim() : ''
    })
    .join('\n\n')
    .replace(/\{\% image (.+?) \%\}/g, '![]($1)')
    .replace(/, alt=/g, '')
    .replace(/\{\% video (.+?) \%\}/g, '::kun-video{src="$1"}')
    .replace(
      /\{\% link ([^,]+),([^,]+),(.+?) \%\}/g,
      (match, text, alt, url) => {
        if (url === '#') {
          return `${text},${alt}`
        } else {
          return `::kun-link{href="${url}" text="${text}, ${alt}"}`
        }
      }
    )
    .replace(/▼ /g, '')

  if (tipText) {
    result = result.replace(
      /(## 游戏介绍)(\s*[\s\S]*?)(?=\n## ▼|$)/,
      (match, header, content) => `${header}\n${tipText}\n\n${content.trim()}`
    )
  }

  if (contentLimit === 'nsfw') {
    result = result.replace(/!\[\]\([^)]+\)/, '')
  }

  return result
}

const mapTypes = (type) => type.map((t) => TYPE_MAP[t])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const withExponentialBackoff = async (
  fn,
  name = 'Psql execute race error.',
  retries = 10,
  delay = 100
) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt < retries - 1) {
        const backoff = delay * Math.pow(2, attempt) + Math.random() * delay
        console.warn(
          `Attempt ${attempt + 1} failed. ${name} Retrying in ${Math.round(backoff)}ms...`
        )
        await sleep(backoff)
      } else {
        console.error(`All ${retries} attempts failed.`)
        throw error
      }
    }
  }
}

const createTags = async (tags) => {
  return await withExponentialBackoff(async () => {
    return await prisma.$transaction(async (prisma) => {
      const tagsData = tags.map((tagName) => ({
        user_id: USER_ID,
        name: tagName.toString(),
        introduction: '',
        alias: []
      }))

      await prisma.patch_tag.createMany({
        data: tagsData,
        skipDuplicates: true
      })

      const tagIds = await prisma.patch_tag.findMany({
        where: {
          name: { in: tags.map((t) => t.toString()) }
        },
        select: { id: true }
      })

      return tagIds.map((tag) => tag.id)
    })
  }, 'createTags')
}

const linkTagsToPatch = async (tagIds, patchId) => {
  if (!tagIds.length) return

  const BATCH_SIZE = 5
  const batches = []
  for (let i = 0; i < tagIds.length; i += BATCH_SIZE) {
    batches.push(tagIds.slice(i, i + BATCH_SIZE))
  }

  for (const batchTagIds of batches) {
    const relationData = batchTagIds.map((tagId) => ({
      patch_id: patchId,
      tag_id: tagId
    }))

    await withExponentialBackoff(async () => {
      await prisma.$transaction(
        async (prisma) => {
          const currentTags = await prisma.patch_tag.findMany({
            where: { id: { in: batchTagIds } },
            select: { id: true, count: true }
          })

          await prisma.patch_tag_relation.createMany({
            data: relationData,
            skipDuplicates: true
          })

          for (const tag of currentTags) {
            await prisma.patch_tag.update({
              where: { id: tag.id },
              data: { count: tag.count + 1 }
            })
          }
        },
        {
          timeout: 60000,
          isolationLevel: 'Serializable'
        }
      )
    }, 'linkTagsToPatch')
  }
}

const createAndLinkTags = async (tags, patchId) => {
  const tagIds = await createTags(tags)
  await linkTagsToPatch(tagIds, patchId)
}

const extractNoteSection = (content) => {
  const match = content.match(/## ▼ 游戏备注\s*([\s\S]+?)$/)
  return match ? match[1].trim() : ''
}

const createPatchResources = async (
  content,
  patch,
  type,
  platform,
  language,
  note
) => {
  const sections = [
    {
      marker: '## ▼ 下载地址',
      name: '电脑版游戏本体下载资源',
      excludeType: new Set(['PE游戏', '模拟器资源', '直装资源']),
      excludePlatform: new Set(['android'])
    },
    {
      marker: '## ▼ PE版下载链接',
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
        await createPatchResource(
          {
            patchId: patch.id,
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

// 重置数据库表
const resetTables = async () => {
  try {
    const tables = [
      { name: 'patch', sequence: 'patch_id_seq' },
      { name: 'patch_resource', sequence: 'patch_resource_id_seq' },
      { name: 'patch_tag', sequence: 'patch_tag_id_seq' },
      { name: 'patch_tag_relation', sequence: 'patch_tag_relation_id_seq' }
    ]

    for (const table of tables) {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "${table.name}" RESTART IDENTITY CASCADE`
      )
    }

    console.log('All tables have been reset successfully.')
  } catch (error) {
    console.error('Error resetting tables:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 主函数
const kun = async () => {
  try {
    // 重置数据库表
    resetTables()

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
