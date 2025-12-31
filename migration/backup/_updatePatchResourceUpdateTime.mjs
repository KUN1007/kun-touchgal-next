import { prisma } from '~/prisma/index'

const updatePatchResourceUpdateTime = async () => {
  try {
    const patches = await prisma.patch.findMany({
      select: {
        id: true,
        created: true
      }
    })

    for (const patch of patches) {
      await prisma.patch.update({
        where: { id: patch.id },
        data: {
          resource_update_time: patch.created
        }
      })

      console.log(`Updated patch with id: ${patch.id}`)
    }

    console.log('Successfully updated all patch records.')
  } catch (error) {
    console.error('Error updating patch records:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updatePatchResourceUpdateTime()
