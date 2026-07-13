import { redis, runRedisCommand } from '~/lib/redis'

const PATCH_VIEWS_BUFFER_KEY = 'kun:touchgal:views:buffer'
const PATCH_VIEWS_PENDING_KEY = `${PATCH_VIEWS_BUFFER_KEY}:pending`

interface PatchViewBufferCheckout {
  key: string
  entries: Record<string, string>
}

export const incrementPatchViewBuffer = async (uniqueId: string) => {
  await runRedisCommand(() =>
    redis.hincrby(PATCH_VIEWS_BUFFER_KEY, uniqueId, 1)
  )
}

export const checkoutPatchViewBuffer =
  async (): Promise<PatchViewBufferCheckout | null> => {
    const hasPending = await runRedisCommand(() =>
      redis.eval(
        `
          if redis.call("EXISTS", KEYS[2]) == 0 then
            if redis.call("EXISTS", KEYS[1]) == 0 then
              return 0
            end
            redis.call("RENAME", KEYS[1], KEYS[2])
          end
          return 1
        `,
        2,
        PATCH_VIEWS_BUFFER_KEY,
        PATCH_VIEWS_PENDING_KEY
      )
    )

    if (hasPending !== 1) {
      return null
    }

    const entries = await runRedisCommand(() =>
      redis.hgetall(PATCH_VIEWS_PENDING_KEY)
    )
    if (Object.keys(entries).length === 0) {
      await runRedisCommand(() => redis.del(PATCH_VIEWS_PENDING_KEY))
      return null
    }

    return {
      key: PATCH_VIEWS_PENDING_KEY,
      entries
    }
  }

export const acknowledgePatchViewBuffer = async (key: string) => {
  if (key !== PATCH_VIEWS_PENDING_KEY) {
    throw new Error('Invalid patch view buffer pending key')
  }

  await runRedisCommand(() => redis.del(key))
}

export const acknowledgePatchViewBufferEntries = async (
  key: string,
  uniqueIds: string[]
) => {
  if (key !== PATCH_VIEWS_PENDING_KEY) {
    throw new Error('Invalid patch view buffer pending key')
  }
  if (uniqueIds.length === 0) {
    return
  }

  await runRedisCommand(() => redis.hdel(key, ...uniqueIds))
}
