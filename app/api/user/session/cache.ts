import { randomUUID } from 'crypto'
import { getKv, setKv } from '~/lib/redis'
import type { UserState } from '~/store/userStore'

const USER_SESSION_CACHE_TTL_SECONDS = 10 * 60
const USER_SESSION_GENERATION_KEY = 'session:user:generation'
const logSessionCacheError = (message: string, error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(message, error)
}

interface UserSessionCacheScope {
  generation: string
  version: string
}

const getUserSessionVersionKey = (uid: number) => `session:user:version:${uid}`

export const getUserSessionInvalidationKv = (uid: number) => ({
  key: getUserSessionVersionKey(uid),
  value: randomUUID()
})

const getUserSessionCacheKey = (
  uid: number,
  { generation, version }: UserSessionCacheScope
) => `session:user:${generation}:${version}:${uid}`

const getUserSessionGeneration = async () =>
  (await getKv(USER_SESSION_GENERATION_KEY)) ?? '0'

const getUserSessionVersion = async (uid: number) =>
  (await getKv(getUserSessionVersionKey(uid))) ?? '0'

export const getUserSessionCacheScope = async (
  uid: number
): Promise<UserSessionCacheScope> => {
  const [generation, version] = await Promise.all([
    getUserSessionGeneration(),
    getUserSessionVersion(uid)
  ])

  return { generation, version }
}

const isSameCacheScope = (
  current: UserSessionCacheScope,
  expected: UserSessionCacheScope
) =>
  current.generation === expected.generation &&
  current.version === expected.version

const parseCachedUserSession = (value: string | null): UserState | null => {
  if (!value) {
    return null
  }

  try {
    const user = JSON.parse(value) as Partial<UserState>
    if (
      typeof user.uid !== 'number' ||
      typeof user.name !== 'string' ||
      !Array.isArray(user.blockedTagIds)
    ) {
      return null
    }

    return user as UserState
  } catch {
    return null
  }
}

export const getCachedUserSession = async (
  uid: number,
  scope: UserSessionCacheScope
) => {
  const cached = await getKv(getUserSessionCacheKey(uid, scope))
  const user = parseCachedUserSession(cached)

  return user ? { user, scope } : null
}

export const setCachedUserSession = async (
  uid: number,
  user: UserState,
  scope: UserSessionCacheScope
) => {
  const currentScope = await getUserSessionCacheScope(uid)
  if (!isSameCacheScope(currentScope, scope)) {
    return
  }

  await setKv(
    getUserSessionCacheKey(uid, scope),
    JSON.stringify(user),
    USER_SESSION_CACHE_TTL_SECONDS
  )
}

export const invalidateUserSession = async (uid: number) => {
  try {
    await setKv(getUserSessionVersionKey(uid), randomUUID())
  } catch (error) {
    logSessionCacheError('Failed to invalidate user session cache:', error)
  }
}

export const invalidateUserSessions = async (uids: number[]) => {
  const uniqueUids = [...new Set(uids)].filter((uid) => Number.isInteger(uid))
  if (!uniqueUids.length) {
    return
  }

  try {
    await Promise.all(
      uniqueUids.map((uid) =>
        setKv(getUserSessionVersionKey(uid), randomUUID())
      )
    )
  } catch (error) {
    logSessionCacheError('Failed to invalidate user session caches:', error)
  }
}

export const invalidateAllUserSessions = async () => {
  try {
    await setKv(USER_SESSION_GENERATION_KEY, randomUUID())
  } catch (error) {
    logSessionCacheError('Failed to invalidate all user session caches:', error)
  }
}
