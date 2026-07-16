import { createHash } from 'crypto'
import { evalKvScript, getKv, setKvIfAbsent } from '~/lib/redis'

export const TWO_FACTOR_CHALLENGE_TTL_SECONDS = 10 * 60
export const TWO_FACTOR_CHALLENGE_MAX_ATTEMPTS = 5

const TWO_FACTOR_UID_WINDOW_SECONDS = 15 * 60
const TWO_FACTOR_UID_MAX_ATTEMPTS = 10
const TWO_FACTOR_UID_IP_WINDOW_SECONDS = 15 * 60
const TWO_FACTOR_UID_IP_MAX_ATTEMPTS = 5

const RESERVE_ATTEMPT_SCRIPT = `
  local challengeUid = redis.call("get", KEYS[1])
  if not challengeUid then
    return {0, 0}
  end
  if challengeUid ~= ARGV[1] then
    return {-1, 0}
  end

  local challengeAttempts = tonumber(redis.call("get", KEYS[2]) or "0")
  if challengeAttempts >= tonumber(ARGV[2]) then
    return {2, 0}
  end

  local uidAttempts = tonumber(redis.call("get", KEYS[3]) or "0")
  if uidAttempts >= tonumber(ARGV[3]) then
    return {3, 0}
  end

  local hasUidIp = ARGV[6] == "1"
  if hasUidIp then
    local uidIpAttempts = tonumber(redis.call("get", KEYS[4]) or "0")
    if uidIpAttempts >= tonumber(ARGV[5]) then
      return {4, 0}
    end
  end

  challengeAttempts = redis.call("incr", KEYS[2])
  if challengeAttempts == 1 then
    local challengeTtl = redis.call("ttl", KEYS[1])
    if challengeTtl > 0 then
      redis.call("expire", KEYS[2], challengeTtl)
    else
      redis.call("expire", KEYS[2], ARGV[7])
    end
  end

  uidAttempts = redis.call("incr", KEYS[3])
  if uidAttempts == 1 then
    redis.call("expire", KEYS[3], ARGV[4])
  end

  if hasUidIp then
    local uidIpAttempts = redis.call("incr", KEYS[4])
    if uidIpAttempts == 1 then
      redis.call("expire", KEYS[4], ARGV[8])
    end
  end

  return {1, tonumber(ARGV[2]) - challengeAttempts}
`

const CONSUME_CHALLENGE_SCRIPT = `
  local challengeUid = redis.call("get", KEYS[1])
  if challengeUid ~= ARGV[1] then
    return 0
  end
  redis.call("del", KEYS[1], KEYS[2], KEYS[3])
  if ARGV[2] == "1" then
    redis.call("del", KEYS[4])
  end
  return 1
`

const getChallengeKey = (jti: string) => `auth:2fa:challenge:${jti}`
const getChallengeAttemptsKey = (jti: string) =>
  `auth:2fa:challenge-attempts:${jti}`
const getUidAttemptsKey = (uid: number) => `auth:2fa:uid-attempts:${uid}`
const getUidIpAttemptsKey = (uid: number, ip: string) => {
  if (!ip) {
    return `auth:2fa:uid-ip-attempts:${uid}:none`
  }
  const digest = createHash('sha256').update(ip).digest('hex')
  return `auth:2fa:uid-ip-attempts:${uid}:${digest}`
}

export type TwoFactorAttemptReservation =
  | { allowed: true; remainingAttempts: number }
  | {
      allowed: false
      reason: 'expired' | 'invalid' | 'challenge' | 'uid' | 'uidIp'
    }

export const createTwoFactorChallenge = async (jti: string, uid: number) => {
  const created = await setKvIfAbsent(
    getChallengeKey(jti),
    String(uid),
    TWO_FACTOR_CHALLENGE_TTL_SECONDS
  )
  if (!created) {
    throw new Error('Failed to create unique 2FA challenge')
  }
}

export const isTwoFactorChallengeActive = async (jti: string, uid: number) =>
  (await getKv(getChallengeKey(jti))) === String(uid)

export const reserveTwoFactorAttempt = async (
  jti: string,
  uid: number,
  ip: string
): Promise<TwoFactorAttemptReservation> => {
  const result = await evalKvScript<number[]>(
    RESERVE_ATTEMPT_SCRIPT,
    [
      getChallengeKey(jti),
      getChallengeAttemptsKey(jti),
      getUidAttemptsKey(uid),
      getUidIpAttemptsKey(uid, ip)
    ],
    [
      uid,
      TWO_FACTOR_CHALLENGE_MAX_ATTEMPTS,
      TWO_FACTOR_UID_MAX_ATTEMPTS,
      TWO_FACTOR_UID_WINDOW_SECONDS,
      TWO_FACTOR_UID_IP_MAX_ATTEMPTS,
      ip ? 1 : 0,
      TWO_FACTOR_CHALLENGE_TTL_SECONDS,
      TWO_FACTOR_UID_IP_WINDOW_SECONDS
    ]
  )

  const [status, remainingAttempts] = result
  if (status === 1) {
    return { allowed: true, remainingAttempts }
  }

  const reason =
    status === 0
      ? 'expired'
      : status === -1
        ? 'invalid'
        : status === 2
          ? 'challenge'
          : status === 3
            ? 'uid'
            : 'uidIp'
  return { allowed: false, reason }
}

export const consumeTwoFactorChallenge = async (
  jti: string,
  uid: number,
  ip: string
) => {
  const result = await evalKvScript<number>(
    CONSUME_CHALLENGE_SCRIPT,
    [
      getChallengeKey(jti),
      getChallengeAttemptsKey(jti),
      getUidAttemptsKey(uid),
      getUidIpAttemptsKey(uid, ip)
    ],
    [uid, ip ? 1 : 0]
  )
  return result === 1
}
