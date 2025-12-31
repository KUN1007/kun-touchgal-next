import { prisma } from '~/prisma/index'

const generateUniqueId = () => {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += characters[Math.floor(Math.random() * characters.length)]
  }
  return id
}

const fixInvalidUniqueId = async () => {
  try {
    const patches = await prisma.patch.findMany()

    const existingIds = new Set(patches.map((patch) => patch.unique_id))

    for (const patch of patches) {
      const { id, unique_id } = patch

      if (!/^[a-z0-9]{8}$/.test(unique_id)) {
        let newUniqueId

        do {
          newUniqueId = generateUniqueId()
        } while (existingIds.has(newUniqueId))

        await prisma.patch.update({
          where: { id },
          data: { unique_id: newUniqueId }
        })

        existingIds.add(newUniqueId)

        console.log(`Updated patch ${id}: ${unique_id} -> ${newUniqueId}`)
      }
    }

    console.log('All invalid unique_ids have been fixed.')
  } catch (error) {
    console.error('Error fixing unique_ids:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixInvalidUniqueId()
