import crypto from 'crypto'
import { prisma } from '~/prisma/index'

const generateRandomEmail = () => {
  const randomString = crypto.randomBytes(8).toString('hex')
  return `${randomString}@example.com`
}

const main = async () => {
  console.log('开始清理重复邮箱任务...')

  console.log('正在获取所有用户信息...')
  const allUsers = await prisma.user.findMany()
  console.log(`共找到 ${allUsers.length} 个用户。`)

  const emailGroups = new Map()
  for (const user of allUsers) {
    if (user.email) {
      const lowerEmail = user.email.toLowerCase()
      if (!emailGroups.has(lowerEmail)) {
        emailGroups.set(lowerEmail, [])
      }
      emailGroups.get(lowerEmail).push(user)
    }
  }

  const userIdsToUpdate = []
  for (const [lowerEmail, usersInGroup] of emailGroups.entries()) {
    if (usersInGroup.length > 1) {
      console.log(
        `\n发现重复邮箱组: ${lowerEmail} (共 ${usersInGroup.length} 个账户)`
      )

      usersInGroup.sort((a, b) => {
        if (b.moemoepoint !== a.moemoepoint) {
          return b.moemoepoint - a.moemoepoint
        }

        return (
          new Date(a.register_time).getTime() -
          new Date(b.register_time).getTime()
        )
      })

      const userToKeep = usersInGroup[0]
      const usersToReset = usersInGroup.slice(1)

      console.log(
        `  - 准备保留: 用户ID ${userToKeep.id} (Email: ${userToKeep.email}, Points: ${userToKeep.moemoepoint})`
      )
      usersToReset.forEach((u) => {
        console.log(
          `  - 准备重置: 用户ID ${u.id} (Email: ${u.email}, Points: ${u.moemoepoint})`
        )
        userIdsToUpdate.push(u.id)
      })
    }
  }

  if (userIdsToUpdate.length > 0) {
    console.log(`\n共找到 ${userIdsToUpdate.length} 个账户需要重置邮箱。`)
    console.log('正在执行数据库更新...')

    const updatePromises = userIdsToUpdate.map((id) =>
      prisma.user.update({
        where: { id },
        data: { email: generateRandomEmail() }
      })
    )

    await prisma.$transaction(updatePromises)

    console.log('所有需要重置的账户邮箱已更新完毕！')
  } else {
    console.log('\n没有找到需要清理的重复邮箱账户。')
  }
}

main()
  .catch((e) => {
    console.error('脚本执行出错:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
