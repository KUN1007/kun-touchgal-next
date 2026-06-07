export type NsfwHeader = Record<string, string | undefined>

export const KUN_AUTH_TOKEN_COOKIE = 'kun-galgame-patch-moe-token'
export const KUN_NSFW_SETTING_COOKIE =
  'kun-patch-setting-store|state|data|kunNsfwEnable'

export const SFW_NSFW_HEADER = { content_limit: 'sfw' } as const

export const isRestrictedNSFWSetting = (token: string | undefined) =>
  token === 'all' || token === 'nsfw'

export const getAuthenticatedNSFWHeader = (
  token: string | undefined
): NsfwHeader => {
  if (token === 'all') {
    return {}
  }

  if (token === 'nsfw') {
    return { content_limit: 'nsfw' }
  }

  return SFW_NSFW_HEADER
}
