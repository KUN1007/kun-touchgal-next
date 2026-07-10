import { describe, expect, it } from 'vitest'
import { isPrismaTransactionConflict } from '~/prisma/index'

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
