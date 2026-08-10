import { prisma } from '~/prisma/index'

const ensureFulfilled = <T>(result: PromiseSettledResult<T>): T => {
  if (result.status === 'rejected') {
    throw result.reason
  }

  return result.value
}

const getDynamicRouteRecords = () =>
  Promise.allSettled([
    prisma.patch.findMany({
      where: { content_limit: 'sfw' },
      select: {
        unique_id: true,
        updated: true
      }
    }),
    prisma.patch_company.findMany({
      select: {
        id: true,
        updated: true
      }
    })
  ])

export const getKunDynamicPatches = async () => {
  try {
    const [patchesResult, companiesResult] = await getDynamicRouteRecords()

    const patches = ensureFulfilled(patchesResult)
    const companies = ensureFulfilled(companiesResult)

    const patchRoutes = patches.map((patch) => ({
      path: `/${patch.unique_id}`,
      lastmod: patch.updated?.toISOString() || new Date().toISOString()
    }))

    const companyRoutes = companies.map((company) => ({
      path: `/company/${company.id}`,
      lastmod: company.updated?.toISOString() || new Date().toISOString()
    }))

    return [...patchRoutes, ...companyRoutes]
  } catch (error) {
    console.error('Error fetching dynamic routes:', error)
    return []
  } finally {
    await prisma.$disconnect()
  }
}
