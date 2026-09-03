import 'dotenv/config'
import { createHash } from 'crypto'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'

const connectionString = `${process.env.KUN_DATABASE_URL}`

const pool = new pg.Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // 空闲取用是 LIFO, 最热的连接在有流量期间永不空闲; 定期回收给每条连接上
  // 只增不减的 prepared statement (实测 24~63 KB/条) 一个时间上界。
  maxLifetimeSeconds: 1800
})

// 名字必须由 SQL 文本确定性派生: pg 按 name 在每条连接上缓存已 Parse 的语句且从不
// DEALLOCATE, 同名异文会直接抛错, 因此名字既不能复用也不能随淘汰变化。
// sha1 十六进制 40 字符, 低于 PostgreSQL 语句名 63 字符上限。
const statementNameGenerator = (query: { sql: string }) =>
  createHash('sha1').update(query.sql).digest('hex')

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

export { isPrismaTransactionConflict, prisma, statementNameGenerator }
