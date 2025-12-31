import { readFile } from 'fs/promises'
import { prisma } from '~/prisma/index'

async function migrateFavorites() {
  try {
    console.log('Starting favorites migration from JSON...')

    const exportData = JSON.parse(
      await readFile('./migration/favorites-export.json', 'utf-8')
    )

    console.log(`Found ${exportData.users.length} users to process`)

    for (const userData of exportData.users) {
      console.log(`Processing user ${userData.id} (${userData.name})...`)

      const defaultFolder = await prisma.user_patch_favorite_folder.upsert({
        where: {
          user_id_name: {
            user_id: userData.id,
            name: '默认收藏夹'
          }
        },
        create: {
          name: '默认收藏夹',
          description: '自动创建的默认收藏夹',
          is_public: true,
          user_id: userData.id
        },
        update: {}
      })

      if (userData.favorites.length > 0) {
        const patchRelations = userData.favorites.map((fav) => ({
          folder_id: defaultFolder.id,
          patch_id: fav.patch_id,
          created: fav.created,
          updated: fav.updated
        }))

        await prisma.user_patch_favorite_folder_relation.createMany({
          data: patchRelations,
          skipDuplicates: true
        })
      }
    }

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migrateFavorites().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
