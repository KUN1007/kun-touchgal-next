import { prisma } from '~/prisma/index'

const DLSITE_API = 'https://dlapi.arnebiae.com/api/dlsite'

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
  const url = `${DLSITE_API}?rj=${encodeURIComponent(normalized)}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('DLSITE_FETCH_FAILED')
  }
  const data = (await response.json()) as DlsiteApiResponse
  return data
}

export const ensurePatchCompanyFromDlsite = async (
  patchId: number,
  dlsiteCode: string | null | undefined,
  uid: number
) => {
  const code = dlsiteCode?.trim()
  if (!code) return

  try {
    const data = await fetchDlsiteData(code)
    const circleName = data.circle_name?.trim()
    if (!circleName) return

    const circleLink = data.circle_link?.trim()

    let company = await prisma.patch_company.findFirst({
      where: { name: circleName }
    })

    if (!company) {
      company = await prisma.patch_company.create({
        data: {
          name: circleName,
          introduction: '',
          count: 0,
          primary_language: [],
          official_website: circleLink ? [circleLink] : [],
          parent_brand: [],
          alias: [],
          user_id: uid
        }
      })
    }

    if (!company) return

    const existingRelation = await prisma.patch_company_relation.findFirst({
      where: { patch_id: patchId, company_id: company.id }
    })

    if (!existingRelation) {
      await prisma.patch_company_relation.create({
        data: {
          patch_id: patchId,
          company_id: company.id
        }
      })

      await prisma.patch_company.update({
        where: { id: company.id },
        data: {
          count: { increment: 1 }
        }
      })
    }
  } catch (error) {
    console.error('Failed to sync DLsite company', error)
  }
}
