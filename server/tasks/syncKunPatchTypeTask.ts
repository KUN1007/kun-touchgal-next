import { prisma } from '~/prisma'
import cron from 'node-cron'
import { KUN_PATCH_WEBSITE_SYNC_PATCH_TYPE_ENDPOINT } from '~/config/external-api'
import {
  enqueueSearchOutbox,
  kickSearchOutboxDrain
} from '~/server/search/sync'
import { withTaskLock } from './withTaskLock'

const SYNC_PATCH_TYPE_LOCK_KEY = 'cron:sync-kun-patch-type:lock'
const SYNC_PATCH_TYPE_LOCK_TTL_SECONDS = 60 * 60

interface MoyuResponse<T> {
  success: boolean
  message: string
  data: T | null
}

const syncKunPatchType = async () => {
  console.log('Starting daily patch type sync task...')

  try {
    const res = await fetch(KUN_PATCH_WEBSITE_SYNC_PATCH_TYPE_ENDPOINT)
    if (!res.ok) {
      throw new Error(`Failed to fetch from API: ${res.statusText}`)
    }
    const response = (await res.json()) as MoyuResponse<string[]>

    if (response.success && Array.isArray(response.data)) {
      const vndbIdsToAddPatch = response.data

      if (vndbIdsToAddPatch.length === 0) {
        return
      }

      // 先取受影响的 id, 更新后据此增量同步搜索索引
      const patchesToUpdate = await prisma.patch.findMany({
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
        select: { id: true }
      })
      if (patchesToUpdate.length === 0) {
        return
      }

      // 复查 NOT 守卫：findMany 与此处之间若有并发写入已补上 'patch'，
      // 直接 push 会造成数组元素重复
      // 事务性入队：type 更新与写出箱入队原子提交（单写 cron，低争用）
      const updateResult = await prisma.$transaction(async (tx) => {
        const result = await tx.patch.updateMany({
          where: {
            id: { in: patchesToUpdate.map((p) => p.id) },
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
        for (const { id } of patchesToUpdate) {
          await enqueueSearchOutbox(tx, id)
        }
        return result
      })

      // 事务内已逐 id 入队，此处一次 kick 即触发 drain 处理整箱（无需逐 id kick）
      kickSearchOutboxDrain()

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

export const syncKunPatchTypeTask = cron.createTask('0 0 * * *', async () => {
  await withTaskLock(
    {
      key: SYNC_PATCH_TYPE_LOCK_KEY,
      ttlSeconds: SYNC_PATCH_TYPE_LOCK_TTL_SECONDS,
      taskName: 'syncKunPatchTypeTask',
      releaseOnComplete: false
    },
    syncKunPatchType
  )
})
