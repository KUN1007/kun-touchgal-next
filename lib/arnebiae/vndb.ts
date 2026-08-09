export const VNDB_API_BASE = 'https://vndbapi.arnebiae.com/kana'

const EXTERNAL_API_TIMEOUT_MS = 10 * 1000

const VNDB_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export const VNDB_HEADERS: Record<string, string> = {
  'User-Agent': VNDB_USER_AGENT,
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6'
}

export const VNDB_API_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  ...VNDB_HEADERS
}

// ===== VN Details Types =====

export interface VNDBTitle {
  lang: string
  title: string
}

export interface VNDBDetailResult {
  title: string
  titles: VNDBTitle[]
  aliases: string[]
  released: string
}

// ===== VN Release Types =====

export interface VNDBReleaseVN {
  id: string
  title?: string
}

export interface VNDBReleaseResult {
  id: string
  title: string
  alttitle?: string
  released?: string
  vns?: VNDBReleaseVN[]
}

// ===== VN Developer Types =====

export interface VndbExtLink {
  url?: string | null
}

export interface VndbProducer {
  id?: string
  name?: string
  original?: string | null
  aliases?: string[] | null
  lang?: string | null
  type?: string | null
  description?: string | null
  extlinks?: VndbExtLink[] | null
}

// ===== VN Tag Types =====

export interface VndbTag {
  id: string
  name: string
  rating: number
  spoiler: number
  lie: boolean
  category: string
}

// ===== Fetch Functions =====

export const fetchVndbVn = async <T>(
  filters: unknown[],
  fields: string,
  results = 1
): Promise<{ results: T[] }> => {
  const res = await fetch(`${VNDB_API_BASE}/vn`, {
    method: 'POST',
    headers: VNDB_API_HEADERS,
    body: JSON.stringify({ filters, fields, results }),
    signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS)
  })

  if (!res.ok) {
    throw new Error(`VNDB API error: ${res.status}`)
  }

  return res.json()
}

export const fetchVndbRelease = async (
  filters: unknown[],
  fields: string,
  results = 1
): Promise<{ results: VNDBReleaseResult[] }> => {
  const res = await fetch(`${VNDB_API_BASE}/release`, {
    method: 'POST',
    headers: VNDB_API_HEADERS,
    body: JSON.stringify({ filters, fields, results }),
    signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS)
  })

  if (!res.ok) {
    throw new Error(`VNDB API error: ${res.status}`)
  }

  return res.json()
}
