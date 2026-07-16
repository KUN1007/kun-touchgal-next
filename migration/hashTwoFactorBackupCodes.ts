import { prisma } from '~/prisma/index'
import {
  hashTwoFactorBackupCode,
  isHashedTwoFactorBackupCode
} from '~/app/api/utils/twoFactorBackupCode'

const BATCH_SIZE = 100

type UserBackupCodes = {
  id: number
  two_factor_backup: string[]
}

const getHashedCodes = (codes: string[]) =>
  codes.map((code) =>
    isHashedTwoFactorBackupCode(code) ? code : hashTwoFactorBackupCode(code)
  )

const areCodesEqual = (left: string[], right: string[]) =>
  left.length === right.length &&
  left.every((code, index) => code === right[index])

const migrateUserBackupCodes = async (
  initialUser: UserBackupCodes
): Promise<'migrated' | 'unchanged' | 'conflict'> => {
  let user = initialUser

  for (let attempt = 0; attempt < 2; attempt++) {
    const hashedCodes = getHashedCodes(user.two_factor_backup)
    if (areCodesEqual(hashedCodes, user.two_factor_backup)) {
      return 'unchanged'
    }

    const result = await prisma.user.updateMany({
      where: {
        id: user.id,
        two_factor_backup: { equals: user.two_factor_backup }
      },
      data: { two_factor_backup: hashedCodes }
    })
    if (result.count === 1) {
      return 'migrated'
    }
    if (attempt === 1) {
      return 'conflict'
    }

    const latestUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, two_factor_backup: true }
    })
    if (!latestUser || latestUser.two_factor_backup.length === 0) {
      return 'unchanged'
    }
    user = latestUser
  }

  return 'conflict'
}

const migrateTwoFactorBackupCodes = async () => {
  let cursor: number | undefined
  let migratedUsers = 0
  let conflictedUsers = 0

  while (true) {
    const users = await prisma.user.findMany({
      where: { two_factor_backup: { isEmpty: false } },
      select: { id: true, two_factor_backup: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    })
    if (users.length === 0) {
      break
    }

    for (const user of users) {
      const result = await migrateUserBackupCodes(user)
      if (result === 'migrated') {
        migratedUsers++
      } else if (result === 'conflict') {
        conflictedUsers++
      }
    }

    cursor = users.at(-1)?.id
  }

  console.log(
    `2FA backup code migration finished: migrated=${migratedUsers}, concurrent_conflicts=${conflictedUsers}`
  )
  if (conflictedUsers > 0) {
    throw new Error(
      `${conflictedUsers} users still had concurrent backup code changes; rerun the migration`
    )
  }
}

migrateTwoFactorBackupCodes()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
