import { fetchVndbVn, type VndbProducer } from '~/lib/arnebiae/vndb'
import { fetchSteamAppData } from '~/lib/arnebiae/steam'
import { fetchDlsiteData } from '~/lib/arnebiae/dlsite'
import { fetchBangumiDeveloperNames } from '~/app/api/edit/bangumi/_developers'
import { ensureCompanies } from '~/app/api/edit/processExternalData'

export interface PatchExternalIds {
  vndbId: string | null
  bangumiId: number | null
  steamId: number | null
  dlsiteCode: string | null
}

// VNDB developer type: co=公司, ng=同人团体, in=个人；其余角色（如发行）排除
const fetchVndbDeveloperNames = async (vndbId: string): Promise<string[]> => {
  try {
    const data = await fetchVndbVn<{ developers?: VndbProducer[] | null }>(
      ['id', '=', vndbId],
      'id,developers{id,name,original,aliases,lang,type,description,extlinks{url}}'
    )
    const devs = data.results?.[0]?.developers ?? []
    return devs
      .filter(
        (d) => d && (d.type === 'co' || d.type === 'ng' || d.type === 'in')
      )
      .map((d) => d.name ?? '')
      .filter(Boolean)
  } catch {
    return []
  }
}

const fetchSteamDevelopers = async (
  steamId: number
): Promise<{ name: string; link: string }[]> => {
  try {
    const data = await fetchSteamAppData(steamId)
    return data.developers ?? []
  } catch {
    return []
  }
}

const fetchDlsiteCircle = async (
  code: string
): Promise<{ name: string; link: string } | null> => {
  try {
    const data = await fetchDlsiteData(code)
    const name = data.circle_name?.trim() ?? ''
    if (!name) return null
    return { name, link: data.circle_link?.trim() ?? '' }
  } catch {
    return null
  }
}

// 并行抓取四来源开发商名，跨来源同名合并去重后复用 ensureCompanies 单次落库
export const gatherAndEnsurePatchCompanies = async (
  patchId: number,
  ids: PatchExternalIds,
  uid: number
): Promise<{ changed: boolean; fetched: number }> => {
  const vndbId = ids.vndbId?.trim() || ''
  const dlsiteCode = ids.dlsiteCode?.trim() || ''

  const [vndbNames, bangumiNames, steamDevs, dlsiteCircle] = await Promise.all([
    vndbId ? fetchVndbDeveloperNames(vndbId) : Promise.resolve<string[]>([]),
    ids.bangumiId
      ? fetchBangumiDeveloperNames(ids.bangumiId)
      : Promise.resolve<string[]>([]),
    ids.steamId
      ? fetchSteamDevelopers(ids.steamId)
      : Promise.resolve<{ name: string; link: string }[]>([]),
    dlsiteCode
      ? fetchDlsiteCircle(dlsiteCode)
      : Promise.resolve<{ name: string; link: string } | null>(null)
  ])

  // 合并顺序 vndb → bangumi → steam → dlsite，官网在会社名首次出现时记录
  const officialWebsiteByName = new Map<string, string[]>()
  const rememberWebsite = (name: string, link: string) => {
    const n = name.trim()
    if (!n || !link || officialWebsiteByName.has(n)) return
    officialWebsiteByName.set(n, [link])
  }

  const names = [...vndbNames, ...bangumiNames]
  for (const dev of steamDevs) {
    names.push(dev.name)
    rememberWebsite(dev.name, dev.link)
  }
  if (dlsiteCircle) {
    names.push(dlsiteCircle.name)
    rememberWebsite(dlsiteCircle.name, dlsiteCircle.link)
  }

  if (!names.some((n) => n && n.trim())) {
    return { changed: false, fetched: 0 }
  }

  const mutationState = { tagChanged: false, companyChanged: false }
  const changed = await ensureCompanies(
    patchId,
    names,
    uid,
    mutationState,
    officialWebsiteByName
  )

  return { changed, fetched: names.length }
}
