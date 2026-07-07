import { prisma } from '~/prisma/index'

// 无 id 的 tag/company 建议项按名称解析为 id 集合，
// 匹配语义与旧实现的 Prisma OR 条件一致（见 app/api/search/route.ts）

export const resolveTagIdsByName = async (name: string): Promise<number[]> => {
  const tags = await prisma.patch_tag.findMany({
    where: { OR: [{ name }, { alias: { has: name } }] },
    select: { id: true }
  })
  return tags.map((tag) => tag.id)
}

export const resolveCompanyIdsByName = async (
  name: string
): Promise<number[]> => {
  const companies = await prisma.patch_company.findMany({
    where: {
      OR: [{ name }, { alias: { has: name } }, { parent_brand: { has: name } }]
    },
    select: { id: true }
  })
  return companies.map((company) => company.id)
}
