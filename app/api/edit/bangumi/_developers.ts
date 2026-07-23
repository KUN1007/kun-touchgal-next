import { BANGUMI_API_BASE, BANGUMI_HEADERS } from '~/constants/bangumi'

export interface BangumiInfoboxItem {
  key: string
  value: string | { v: string }[]
}

const DEVELOPER_KEYS = new Set([
  '开发',
  '游戏开发商',
  '开发商',
  '发行',
  '发行商',
  '制作',
  '製作'
])

const splitByJapaneseSeparator = (name: string): string[] =>
  name
    .split('、')
    .map((s) => s.trim())
    .filter(Boolean)

export const extractDevelopers = (infobox?: BangumiInfoboxItem[]): string[] => {
  if (!infobox) return []
  const names: string[] = []
  for (const item of infobox) {
    if (!DEVELOPER_KEYS.has(item.key)) continue
    if (typeof item.value === 'string') {
      names.push(...splitByJapaneseSeparator(item.value))
    } else if (Array.isArray(item.value)) {
      for (const entry of item.value) {
        if (entry.v?.trim()) names.push(...splitByJapaneseSeparator(entry.v))
      }
    }
  }
  return [...new Set(names)]
}

export const fetchBangumiDeveloperNames = async (
  bangumiId: number
): Promise<string[]> => {
  try {
    const res = await fetch(`${BANGUMI_API_BASE}/v0/subjects/${bangumiId}`, {
      headers: BANGUMI_HEADERS
    })
    if (!res.ok) return []
    const data = (await res.json()) as { infobox?: BangumiInfoboxItem[] }
    return extractDevelopers(data.infobox)
  } catch {
    return []
  }
}
