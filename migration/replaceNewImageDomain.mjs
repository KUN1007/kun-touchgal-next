import { PrismaClient } from '@prisma/client'
import { promises as fs } from 'fs'
import path from 'path'

const prisma = new PrismaClient()
const DOMAIN = 'img.touchgalstatic.org'
const NEW_DOMAIN = 'cloud.touchgaloss.com'
const BATCH_SIZE = 100
const SCHEMA_PATH = path.resolve(process.cwd(), 'prisma', 'schema.prisma')

const parsePrismaSchema = (schema) => {
  const withoutBlockComments = schema.replace(/\/\*[\s\S]*?\*\//g, '')
  const lines = withoutBlockComments.split(/\r?\n/)

  const results = []
  let inModel = false
  let currentModel = ''
  let currentIdField = 'id'
  let pendingFields = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('//')) continue

    if (!inModel) {
      const m = line.match(/^model\s+([A-Za-z0-9_]+)\s*\{/)
      if (m) {
        inModel = true
        currentModel = m[1]
        currentIdField = 'id'
        pendingFields = []
      }
      continue
    }

    if (line.startsWith('}')) {
      for (const f of pendingFields)
        results.push({ model: currentModel, field: f, idField: currentIdField })
      inModel = false
      currentModel = ''
      currentIdField = 'id'
      pendingFields = []
      continue
    }
    if (line.startsWith('@@')) continue

    const parts = line.split(/\s+/)
    if (parts.length < 2) continue

    const [fieldName, fieldType] = parts
    if (/@id\b/.test(line)) currentIdField = fieldName

    const isString = /^String\??$/.test(fieldType)
    if (isString) pendingFields.push(fieldName)
  }
  return results
}

const escapeRegExp = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const collectMatchingIds = async (delegate, where, idField) => {
  const ids = []
  let lastId = undefined
  for (;;) {
    const page = await delegate.findMany({
      where,
      select: { [idField]: true },
      orderBy: { [idField]: 'asc' },
      ...(lastId ? { cursor: { [idField]: lastId }, skip: 1 } : {}),
      take: BATCH_SIZE
    })
    if (!page.length) break
    for (const row of page) ids.push(row[idField])
    lastId = page[page.length - 1][idField]
    if (page.length < BATCH_SIZE) break
  }
  return ids
}

const replaceForField = async (model, field, idField) => {
  const delegate = prisma[model]
  if (!delegate) return { updated: 0, error: `No delegate for model ${model}` }

  const where = { [field]: { contains: DOMAIN, mode: 'insensitive' } }

  let count = 0
  try {
    count = await delegate.count({ where })
  } catch (err) {
    return { updated: 0, error: err?.message || String(err) }
  }
  if (count === 0) return { updated: 0 }

  const regex = new RegExp(escapeRegExp(DOMAIN), 'gi')

  const ids = await collectMatchingIds(delegate, where, idField)

  let updated = 0
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE)
    const rows = await delegate.findMany({
      where: { [idField]: { in: chunk } },
      select: { [idField]: true, [field]: true }
    })
    for (const r of rows) {
      const oldVal = r[field]
      if (typeof oldVal !== 'string' || !oldVal) continue
      const newVal = oldVal.replace(regex, NEW_DOMAIN)
      if (newVal !== oldVal) {
        await delegate.update({
          where: { [idField]: r[idField] },
          data: { [field]: newVal }
        })
        updated += 1
      }
    }
  }
  return { updated }
}

const main = async () => {
  const schema = await fs.readFile(SCHEMA_PATH, 'utf8')
  const candidates = parsePrismaSchema(schema)

  for (const { model, field, idField } of candidates) {
    const res = await replaceForField(model, field, idField)
    if (res?.error) {
      continue
    }
    if ((res?.updated || 0) > 0) {
      console.log(
        `${model} model - ${field} 字段存在 --- ${res.updated} 条数据已完成域名替换`
      )
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
