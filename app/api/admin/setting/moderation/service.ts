import { getKv } from '~/lib/redis'
import {
  KUN_MODERATION_DRY_RUN_KEY,
  KUN_MODERATION_ENABLED_KEY
} from '~/config/redis'

export const getModerationSetting = async () => {
  const [enabled, dryRun] = await Promise.all([
    getKv(KUN_MODERATION_ENABLED_KEY),
    getKv(KUN_MODERATION_DRY_RUN_KEY)
  ])
  return {
    enabled: !!enabled,
    dryRun: !!dryRun
  }
}
