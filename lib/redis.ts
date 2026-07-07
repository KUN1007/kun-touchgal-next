import Redis from 'ioredis'
import type { RedisOptions } from 'ioredis'
import { randomUUID } from 'crypto'

const KUN_PATCH_REDIS_PREFIX = 'kun:touchgal'
const REDIS_MULTI_KEY_BATCH_SIZE = 500
const REDIS_CONNECT_TIMEOUT_MS = 2000
const REDIS_COMMAND_TIMEOUT_MS = 2000
const REDIS_RETRY_BASE_DELAY_MS = 100
const REDIS_RETRY_MAX_DELAY_MS = 2000
const SET_KVS_AND_ADD_SET_MEMBERS_EXTEND_TTL_SCRIPT = `
  local valueCount = tonumber(ARGV[1])
  local setTtl = tonumber(ARGV[2])
  local argIndex = 3

  for i = 1, valueCount do
    local value = ARGV[argIndex]
    local keyTtl = tonumber(ARGV[argIndex + 1])
    if keyTtl and keyTtl > 0 then
      redis.call("setex", KEYS[i], keyTtl, value)
    else
      redis.call("set", KEYS[i], value)
    end
    argIndex = argIndex + 2
  end

  local setKey = KEYS[valueCount + 1]
  local memberCount = tonumber(ARGV[argIndex])
  argIndex = argIndex + 1

  for i = 1, memberCount do
    redis.call("sadd", setKey, ARGV[argIndex])
    argIndex = argIndex + 1
  end

  local currentTtl = redis.call("ttl", setKey)
  if currentTtl < 0 or currentTtl < setTtl then
    redis.call("expire", setKey, setTtl)
  end

  return 1
`

const EXPIRE_KV_IF_TTL_LESS_THAN_SCRIPT = `
  local keyTtl = tonumber(ARGV[1])
  local currentTtl = redis.call("ttl", KEYS[1])
  if currentTtl < 0 or currentTtl < keyTtl then
    return redis.call("expire", KEYS[1], keyTtl)
  end

  return 0
`

const redisOptions: RedisOptions = {
  port: parseInt(process.env.REDIS_PORT!),
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
  commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
  retryStrategy: (times) =>
    Math.min(times * REDIS_RETRY_BASE_DELAY_MS, REDIS_RETRY_MAX_DELAY_MS)
}

export const redis = new Redis(redisOptions)

let redisConnectPromise: Promise<void> | null = null

const connectRedis = async () => {
  if (redis.status === 'ready') {
    return
  }

  if (redisConnectPromise) {
    await redisConnectPromise
    return
  }

  if (redis.status !== 'wait' && redis.status !== 'end') {
    return
  }

  redisConnectPromise = redis.connect().finally(() => {
    redisConnectPromise = null
  })
  await redisConnectPromise
}

export const runRedisCommand = async <T>(command: () => Promise<T>) => {
  await connectRedis()
  return command()
}

export const setKv = async (key: string, value: string, time?: number) => {
  const keyString = `${KUN_PATCH_REDIS_PREFIX}:${key}`
  if (time) {
    await runRedisCommand(() => redis.setex(keyString, time, value))
  } else {
    await runRedisCommand(() => redis.set(keyString, value))
  }
}

export const getKv = async (key: string) => {
  const keyString = `${KUN_PATCH_REDIS_PREFIX}:${key}`
  const value = await runRedisCommand(() => redis.get(keyString))
  return value
}

export const setKvIfAbsent = async (
  key: string,
  value: string,
  time: number
) => {
  const keyString = `${KUN_PATCH_REDIS_PREFIX}:${key}`
  const result = await runRedisCommand(() =>
    redis.set(keyString, value, 'EX', time, 'NX')
  )
  return result === 'OK'
}

export const getKvs = async (keys: string[]) => {
  if (keys.length === 0) {
    return []
  }

  const keyStrings = keys.map((key) => `${KUN_PATCH_REDIS_PREFIX}:${key}`)
  return runRedisCommand(() => redis.mget(...keyStrings))
}

export const delKv = async (key: string) => {
  const keyString = `${KUN_PATCH_REDIS_PREFIX}:${key}`
  await runRedisCommand(() => redis.del(keyString))
}

export const delKvs = async (keys: string[]) => {
  if (keys.length === 0) {
    return
  }

  const keyStrings = keys.map((key) => `${KUN_PATCH_REDIS_PREFIX}:${key}`)
  for (let i = 0; i < keyStrings.length; i += REDIS_MULTI_KEY_BATCH_SIZE) {
    await runRedisCommand(() =>
      redis.del(...keyStrings.slice(i, i + REDIS_MULTI_KEY_BATCH_SIZE))
    )
  }
}

interface KvValue {
  key: string
  value: string
  ttlSeconds?: number
}

interface KvSetMembers {
  key: string
  members: string[]
  setTtlSeconds?: number
}

export const setKvsAndAddKvSetMembers = async (
  values: KvValue[],
  set: KvSetMembers
) => {
  const { key: setKey, members, setTtlSeconds } = set
  const shouldExtendSetTtl =
    typeof setTtlSeconds === 'number' && setTtlSeconds > 0
  if (values.length === 0 && members.length === 0 && !shouldExtendSetTtl) {
    return
  }

  const setKeyString = `${KUN_PATCH_REDIS_PREFIX}:${setKey}`
  if (shouldExtendSetTtl) {
    const keys = [
      ...values.map(({ key }) => `${KUN_PATCH_REDIS_PREFIX}:${key}`),
      setKeyString
    ]
    const args = [values.length.toString(), setTtlSeconds.toString()]
    for (const { value, ttlSeconds } of values) {
      args.push(value, (ttlSeconds ?? 0).toString())
    }
    args.push(members.length.toString(), ...members)

    await runRedisCommand(() =>
      redis.eval(
        SET_KVS_AND_ADD_SET_MEMBERS_EXTEND_TTL_SCRIPT,
        keys.length,
        ...keys,
        ...args
      )
    )
    return
  }

  await runRedisCommand(async () => {
    const multi = redis.multi()
    for (const { key, value, ttlSeconds } of values) {
      const keyString = `${KUN_PATCH_REDIS_PREFIX}:${key}`
      if (ttlSeconds) {
        multi.setex(keyString, ttlSeconds, value)
      } else {
        multi.set(keyString, value)
      }
    }
    if (members.length > 0) {
      multi.sadd(setKeyString, ...members)
    }

    const results = await multi.exec()
    if (!results) {
      throw new Error('Redis transaction failed')
    }
    const failed = results.find(([error]) => error)
    if (failed?.[0]) {
      throw failed[0]
    }
  })
}

export const delKvsAndRemoveKvSetMembers = async (
  keys: string[],
  setKey: string,
  members: string[]
) => {
  if (keys.length === 0 && members.length === 0) {
    return
  }

  const setKeyString = `${KUN_PATCH_REDIS_PREFIX}:${setKey}`
  await runRedisCommand(async () => {
    const multi = redis.multi()
    const keyStrings = keys.map((key) => `${KUN_PATCH_REDIS_PREFIX}:${key}`)
    for (let i = 0; i < keyStrings.length; i += REDIS_MULTI_KEY_BATCH_SIZE) {
      multi.del(...keyStrings.slice(i, i + REDIS_MULTI_KEY_BATCH_SIZE))
    }
    if (members.length > 0) {
      multi.srem(setKeyString, ...members)
    }

    const results = await multi.exec()
    if (!results) {
      throw new Error('Redis transaction failed')
    }
    const failed = results.find(([error]) => error)
    if (failed?.[0]) {
      throw failed[0]
    }
  })
}

export const getKvSetMembers = async (key: string) => {
  const keyString = `${KUN_PATCH_REDIS_PREFIX}:${key}`
  return runRedisCommand(() => redis.smembers(keyString))
}

export const addKvSetMembers = async (key: string, members: string[]) => {
  if (members.length === 0) {
    return
  }

  const keyString = `${KUN_PATCH_REDIS_PREFIX}:${key}`
  await runRedisCommand(() => redis.sadd(keyString, ...members))
}

export const removeKvSetMembers = async (key: string, members: string[]) => {
  if (members.length === 0) {
    return
  }

  const keyString = `${KUN_PATCH_REDIS_PREFIX}:${key}`
  await runRedisCommand(() => redis.srem(keyString, ...members))
}

export const setKvAndExpireKvIfTtlLessThan = async (
  key: string,
  value: string,
  keyTime: number,
  ttlKey: string,
  ttlTime: number
) => {
  if (keyTime <= 0) {
    return
  }

  const keyString = `${KUN_PATCH_REDIS_PREFIX}:${key}`
  const ttlKeyString = `${KUN_PATCH_REDIS_PREFIX}:${ttlKey}`
  await runRedisCommand(async () => {
    const pipeline = redis.pipeline()
    pipeline.setex(keyString, keyTime, value)
    if (ttlTime > 0) {
      pipeline.eval(EXPIRE_KV_IF_TTL_LESS_THAN_SCRIPT, 1, ttlKeyString, ttlTime)
    }

    const results = await pipeline.exec()
    if (!results) {
      throw new Error('Redis pipeline failed')
    }
    const failed = results.find(([error]) => error)
    if (failed?.[0]) {
      throw failed[0]
    }
  })
}

export const acquireKvLock = async (key: string, ttlSeconds = 10) => {
  const keyString = `${KUN_PATCH_REDIS_PREFIX}:${key}`
  const token = randomUUID()
  const result = await runRedisCommand(() =>
    redis.set(keyString, token, 'EX', ttlSeconds, 'NX')
  )

  if (result !== 'OK') {
    return null
  }

  return token
}

export const releaseKvLock = async (key: string, token: string) => {
  const keyString = `${KUN_PATCH_REDIS_PREFIX}:${key}`
  await runRedisCommand(() =>
    redis.eval(
      `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        end
        return 0
      `,
      1,
      keyString,
      token
    )
  )
}
