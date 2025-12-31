import { prisma } from '~/prisma/index'

async function updateReleasedField() {
  try {
    const updatedRecords = await prisma.patch.updateMany({
      where: {
        released: ''
      },
      data: {
        released: 'unknown'
      }
    })

    console.log(`Updated ${updatedRecords.count} records.`)
  } catch (error) {
    console.error('Error updating records: ', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateReleasedField()
