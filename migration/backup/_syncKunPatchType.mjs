import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// export const KUN_PATCH_WEBSITE_SYNC_PATCH_TYPE_ENDPOINT = `http://127.0.0.1:2333/api/moyu/patch/has-patch`
export const KUN_PATCH_WEBSITE_SYNC_PATCH_TYPE_ENDPOINT = `https://www.moyu.moe/api/moyu/patch/has-patch`

const syncKunPatchType = async () => {
  console.log('Starting daily patch type sync task...')

  try {
    const res = await fetch(KUN_PATCH_WEBSITE_SYNC_PATCH_TYPE_ENDPOINT)
    if (!res.ok) {
      throw new Error(`Failed to fetch from API: ${res.statusText}`)
    }
    const response = await res.json()

    if (response.success && Array.isArray(response.data)) {
      const vndbIdsToAddPatch = response.data

      if (vndbIdsToAddPatch.length === 0) {
        return
      }

      const updateResult = await prisma.patch.updateMany({
        where: {
          vndb_id: {
            in: vndbIdsToAddPatch
          },
          NOT: {
            type: {
              has: 'patch'
            }
          }
        },
        data: {
          type: {
            push: 'patch'
          }
        }
      })

      console.log(
        `Successfully updated ${updateResult.count} patch records. Task finished.`
      )
    } else {
      console.error(
        'API response was not successful or data is invalid.',
        response
      )
    }
  } catch (error) {
    console.error('An error occurred during the daily patch sync task:', error)
  }
}

syncKunPatchType()
