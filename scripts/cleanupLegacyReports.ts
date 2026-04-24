import { prisma } from '../prisma'

const run = async () => {
  // Legacy report records used type='report' with recipient_id=null to mean
  // "a pending/handled report entry". Notifications sent back to reporters
  // (recipient_id set) are kept intact.
  const result = await prisma.user_message.deleteMany({
    where: {
      type: 'report',
      recipient_id: null
    }
  })
  console.log(`Deleted ${result.count} legacy report messages`)
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
