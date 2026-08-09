export const DLSITE_API = 'https://dlapi.arnebiae.com/api/dlsite'

const EXTERNAL_API_TIMEOUT_MS = 10 * 1000

export interface DlsiteApiResponse {
  rj_code: string
  title_default: string
  title_jp?: string
  title_en?: string
  release_date?: string
  tags?: string
  circle_name?: string
  circle_link?: string
}

export const fetchDlsiteData = async (
  code: string
): Promise<DlsiteApiResponse> => {
  const normalized = code.trim().toUpperCase()
  const url = `${DLSITE_API}?code=${encodeURIComponent(normalized)}`
  const response = await fetch(url, {
    signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS)
  })
  if (!response.ok) {
    throw new Error('DLSITE_FETCH_FAILED')
  }
  const data = (await response.json()) as { data: DlsiteApiResponse }
  return data.data
}
