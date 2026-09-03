import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// 指向 user 的外键随 user.delete() 级联删除; PostgreSQL 不为外键列自动建索引,
// 级联触发器对无前导索引的列做全表扫描, 成本随表体积线性增长
const schemaDir = fileURLToPath(new URL('../schema/', import.meta.url))

const userForeignKeys = readdirSync(schemaDir)
  .filter((file) => file.endsWith('.prisma'))
  .flatMap((file) => [
    ...readFileSync(`${schemaDir}${file}`, 'utf8').matchAll(
      /^model (\w+) \{([\s\S]*?)^\}/gm
    )
  ])
  .flatMap(([, model, body]) =>
    [
      ...body.matchAll(
        /^\s*\w+\s+user\??\s+@relation\([^)]*fields: \[(\w+)\]/gm
      )
    ].map(([, column]) => ({
      name: `${model}.${column}`,
      column,
      body
    }))
  )

describe('user 外键列前导索引', () => {
  it('发现全部 user 外键', () => {
    expect(userForeignKeys.length).toBeGreaterThanOrEqual(24)
  })

  it.each(userForeignKeys)('$name', ({ column, body }) => {
    expect(body).toMatch(new RegExp(`@@(index|unique)\\(\\[${column}[,\\]\\(]`))
  })
})
