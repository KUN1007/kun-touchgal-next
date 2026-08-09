export const STEAM_API_BASE = 'https://steamapi.arnebiae.com/api'

const EXTERNAL_API_TIMEOUT_MS = 10 * 1000

export interface SteamDeveloper {
  name: string
  link: string
}

export interface SteamAppData {
  appid: string
  name: string
  aliases: {
    english?: string
    japanese?: string
    tchinese?: string
  }
  releaseDate: string
  tags: string[]
  developers: SteamDeveloper[]
}

export interface SteamApiResponse {
  success: boolean
  data?: SteamAppData
  warning: string | null
  error?: string
  message?: string
}

export const fetchSteamAppData = async (
  steamId: number
): Promise<SteamAppData> => {
  const res = await fetch(
    `${STEAM_API_BASE}/app/${steamId}/tags?lang=schinese`,
    { signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS) }
  )

  if (!res.ok) {
    throw new Error('STEAM_FETCH_FAILED')
  }

  const data = (await res.json()) as SteamApiResponse

  if (!data.success || !data.data) {
    throw new Error(data.error || data.warning || 'STEAM_FETCH_FAILED')
  }

  return data.data
}
