import { prisma } from '~/prisma/index'
import { fetchDlsiteData } from '~/lib/arnebiae/dlsite'
import { invalidateCompanyListCache } from '~/app/api/company/cache'

export { fetchDlsiteData } from '~/lib/arnebiae/dlsite'
export type { DlsiteApiResponse } from '~/lib/arnebiae/dlsite'

export const ensurePatchCompanyFromDlsite = async (
  patchId: number,
  dlsiteCode: string | null | undefined,
  uid: number,
  prefetchedCircleName?: string | null,
  prefetchedCircleLink?: string | null
) => {
  const code = dlsiteCode?.trim()
  if (!code) return

  try {
    let circleName = prefetchedCircleName?.trim() || ''
    let circleLink = prefetchedCircleLink?.trim() || ''

    if (!circleName) {
      const data = await fetchDlsiteData(code)
      circleName = data.circle_name?.trim() ?? ''
      circleLink = data.circle_link?.trim() ?? ''
    }

    if (!circleName) return
    let changed = false

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
      changed = true
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
      changed = true
    }

    if (changed) {
      await invalidateCompanyListCache()
    }
  } catch {
    // 忽略同步失败，避免阻塞主流程
  }
}
