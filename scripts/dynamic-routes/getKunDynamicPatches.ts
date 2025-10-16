import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const getKunDynamicPatches = async () => {
  try {
    const patches = await prisma.patch.findMany({
      where: { content_limit: 'sfw' },
      select: {
        unique_id: true,
        updated: true
      }
    })

    const tags = await prisma.patch_tag.findMany({
      select: {
        id: true,
        updated: true
      }
    })

    const companies = await prisma.patch_company.findMany({
      select: {
        id: true,
        updated: true
      }
    })

    const patchRoutes = patches.map((patch) => ({
      path: `/${patch.unique_id}`,
      lastmod: patch.updated?.toISOString() || new Date().toISOString()
    }))

    const tagRoutes = tags.map((tag) => ({
      path: `/tag/${tag.id}`,
      lastmod: tag.updated?.toISOString() || new Date().toISOString()
    }))

    const companyRoutes = companies.map((company) => ({
      path: `/company/${company.id}`,
      lastmod: company.updated?.toISOString() || new Date().toISOString()
    }))

    return [...patchRoutes, ...tagRoutes, ...companyRoutes]
  } catch (error) {
    console.error('Error fetching dynamic routes:', error)
    return []
  } finally {
    await prisma.$disconnect()
  }
}
