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

const hasRetryablePostgresCode = (value: unknown) => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const code =
    'originalCode' in value
      ? value.originalCode
      : 'code' in value
        ? value.code
        : undefined
  return code === '40001' || code === '40P01'
}

const isPrismaTransactionConflict = (error: unknown) => {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  if ('code' in error && error.code === 'P2034') {
    return true
  }
  if ('cause' in error && hasRetryablePostgresCode(error.cause)) {
    return true
  }
  if (!('meta' in error) || typeof error.meta !== 'object' || !error.meta) {
    return false
  }

  const driverError =
    'driverAdapterError' in error.meta
      ? error.meta.driverAdapterError
      : undefined
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'cause' in driverError &&
    hasRetryablePostgresCode(driverError.cause)
  )
}

export { isPrismaTransactionConflict, prisma }
