import { prisma } from '~/prisma/index'
import { promises as fs } from 'fs'
import path from 'path'

const DOMAIN = 'img.touchgalstatic.org'
const SCHEMA_PATH = path.resolve(process.cwd(), 'prisma', 'schema.prisma')

const classifyField = (fieldName) => {
  const name = fieldName.toLowerCase()
  const urlLike = [
    'url',
    'link',
    'avatar',
    'banner',
    'image',
    'img',
    'logo',
    'cover',
    'thumb',
    'thumbnail',
    'picture',
    'photo',
    'icon',
    'background',
    'bg',
    'poster',
    'header',
    'splash',
    'favicon'
  ]
  if (urlLike.some((k) => name.includes(k))) return true

  if (name === 'content') return true
  const contentLike = [
    'introduction',
    'intro',
    'desc',
    'description',
    'bio',
    'note',
    'edit',
    'html',
    'markdown',
    'md',
    'text'
  ]
  if (contentLike.some((k) => name.includes(k))) return true
  return false
}

const parsePrismaSchema = (schema) => {
  const withoutBlockComments = schema.replace(/\/\*[\s\S]*?\*\//g, '')
  const lines = withoutBlockComments.split(/\r?\n/)
  const candidates = []
  let inModel = false
  let currentModel = ''

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('//')) continue

    if (!inModel) {
      const m = line.match(/^model\s+([A-Za-z0-9_]+)\s*\{/)
      if (m) {
        inModel = true
        currentModel = m[1]
      }
      continue
    }

    if (line.startsWith('}')) {
      inModel = false
      currentModel = ''
      continue
    }
    if (line.startsWith('@@')) continue

    const parts = line.split(/\s+/)
    if (parts.length < 2) continue
    const [fieldName, fieldType] = parts
    const isString = /^String\??$/.test(fieldType)
    if (!isString) continue

    if (classifyField(fieldName)) {
      candidates.push({ model: currentModel, field: fieldName })
    }
  }
  return candidates
}

const existsForField = async (model, field) => {
  const delegate = prisma[model]
  if (!delegate) return false
  try {
    const count = await delegate.count({
      where: { [field]: { contains: DOMAIN, mode: 'insensitive' } }
    })
    return count > 0
  } catch {
    return false
  }
}

const main = async () => {
  const schema = await fs.readFile(SCHEMA_PATH, 'utf8')
  const candidates = parsePrismaSchema(schema)

  for (const { model, field } of candidates) {
    const exists = await existsForField(model, field)
    if (exists) {
      console.log(`${model} model - ${field} 字段 存在`)
    }
  }
}

main()
  .catch((err) => {
    console.error(err?.message || String(err))
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
