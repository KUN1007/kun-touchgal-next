import { getKv } from '~/lib/redis'
import {
  KUN_MODERATION_DRY_RUN_KEY,
  KUN_MODERATION_ENABLED_KEY
} from '~/config/redis'

export interface ModerationConfig {
  enabled: boolean
  dryRun: boolean
}

const CONFIG_CACHE_DURATION = 30 * 1000

let configCache: { value: ModerationConfig; expire: number } | null = null

export const getModerationConfig = async (): Promise<ModerationConfig> => {
  const now = Date.now()
  if (configCache && configCache.expire > now) {
    return configCache.value
  }

  const [enabled, dryRun] = await Promise.all([
    getKv(KUN_MODERATION_ENABLED_KEY),
    getKv(KUN_MODERATION_DRY_RUN_KEY)
  ])
  const value = { enabled: !!enabled, dryRun: !!dryRun }
  configCache = { value, expire: now + CONFIG_CACHE_DURATION }

  return value
}

export const clearModerationConfigCache = () => {
  configCache = null
}
