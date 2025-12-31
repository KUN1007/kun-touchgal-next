import { writeFile } from 'fs/promises'
import { prisma } from '~/prisma/index'

async function exportFavorites() {
  try {
    console.log('Starting favorites export...')

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        patch_favorite: {
          select: {
            patch_id: true,
            created: true,
            updated: true
          }
        }
      }
    })

    console.log(`Found ${users.length} users to export`)

    const exportData = {
      exportDate: new Date().toISOString(),
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        favorites: user.patch_favorite
      }))
    }

    await writeFile(
      './migration/favorites-export.json',
      JSON.stringify(exportData, null, 2)
    )

    console.log(`Export completed successfully!`)
  } catch (error) {
    console.error('Export failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

exportFavorites().catch((error) => {
  console.error('Export failed:', error)
  process.exit(1)
})
