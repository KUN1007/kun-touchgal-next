import { describe, expect, it } from 'vitest'
import {
  isPrismaTransactionConflict,
  statementNameGenerator
} from '~/prisma/index'

describe('statementNameGenerator', () => {
  const sql3 = 'SELECT "id" FROM "patch" WHERE "id" IN ($1,$2,$3) OFFSET $4'
  const sql5 =
    'SELECT "id" FROM "patch" WHERE "id" IN ($1,$2,$3,$4,$5) OFFSET $6'

  it('derives the same name for the same sql text', () => {
    expect(statementNameGenerator({ sql: sql3 })).toBe(
      statementNameGenerator({ sql: sql3 })
    )
  })

  it('derives different names for different sql text', () => {
    expect(statementNameGenerator({ sql: sql3 })).not.toBe(
      statementNameGenerator({ sql: sql5 })
    )
  })

  it('stays within the postgres statement name length limit', () => {
    expect(statementNameGenerator({ sql: sql3 })).toMatch(/^[0-9a-f]{40}$/)
  })
})

describe('isPrismaTransactionConflict', () => {
  it.each([
    ['Prisma write conflict', { code: 'P2034' }],
    [
      'driver adapter deadlock',
      {
        name: 'DriverAdapterError',
        cause: { kind: 'postgres', originalCode: '40P01' }
      }
    ],
    [
      'raw query deadlock',
      {
        code: 'P2010',
        meta: {
          driverAdapterError: {
            cause: { kind: 'postgres', originalCode: '40P01' }
          }
        }
      }
    ]
  ])('recognizes %s', (_name, error) => {
    expect(isPrismaTransactionConflict(error)).toBe(true)
  })

  it('rejects unrelated Prisma errors', () => {
    expect(isPrismaTransactionConflict({ code: 'P2002' })).toBe(false)
  })
})
