import { readFile } from 'fs/promises'
import { ADMIN_REDIRECT_CONFIG_CACHE_DURATION } from '~/config/cache'
import { getKv, setKv } from '~/lib/redis'
import { resolveRuntimeFile } from '~/lib/runtimePaths'
import { prisma } from '~/prisma/index'
import type { AdminRedirectConfig } from '~/types/api/admin'

export const ADMIN_REDIRECT_REDIS_KEY = 'admin:config:redirect'
export const ADMIN_REDIRECT_SETTING_KEY = 'redirect'

export const getRedirectConfig = async () => {
  const redirectJson = await getKv(ADMIN_REDIRECT_REDIS_KEY)
  if (redirectJson) {
    return JSON.parse(redirectJson) as AdminRedirectConfig
  }

  // 事实源在 admin_setting 表; Redis 仅作缓存, 磁盘 JSON 只是从未保存过时的出厂默认
  const setting = await prisma.admin_setting.findUnique({
    where: { key: ADMIN_REDIRECT_SETTING_KEY }
  })
  if (setting) {
    const config = setting.value as unknown as AdminRedirectConfig
    await setKv(
      ADMIN_REDIRECT_REDIS_KEY,
      JSON.stringify(config),
      ADMIN_REDIRECT_CONFIG_CACHE_DURATION
    )
    return config
  }

  const configPath = resolveRuntimeFile('config/redirect.json')
  const redirectJsonFile = (await readFile(
    configPath,
    'utf8'
  )) as unknown as string
  await setKv(
    ADMIN_REDIRECT_REDIS_KEY,
    redirectJsonFile,
    ADMIN_REDIRECT_CONFIG_CACHE_DURATION
  )

  return JSON.parse(redirectJsonFile) as AdminRedirectConfig
}
