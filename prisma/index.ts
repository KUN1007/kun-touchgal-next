import 'dotenv/config'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'

const connectionString = `${process.env.KUN_DATABASE_URL}`

const pool = new pg.Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
})

const STATEMENT_CACHE_MAX = 1000
const statementNames = new Map<string, string>()
let statementCounter = 0

const statementNameGenerator = (query: { sql: string }) => {
  const cached = statementNames.get(query.sql)
  if (cached !== undefined) return cached
  if (statementNames.size >= STATEMENT_CACHE_MAX) {
    const oldest = statementNames.keys().next().value
    if (oldest !== undefined) statementNames.delete(oldest)
  }
  const name = `s${(statementCounter++).toString(36)}`
  statementNames.set(query.sql, name)
  return name
}

const adapter = new PrismaPg(pool, { statementNameGenerator })
const prisma = new PrismaClient({ adapter })

export { prisma }
