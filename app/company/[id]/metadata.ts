import { kunMoyuMoe } from '~/config/moyu-moe'
import type { Metadata } from 'next'
import type { CompanyDetail } from '~/types/api/company'

export const generateKunMetadataTemplate = (
  company: CompanyDetail
): Metadata => {
  return {
    title: `所属会社为 ${company.name} 的 Galgame`,
    description: company.introduction,
    openGraph: {
      title: `所属会社为 ${company.name} 的 Galgame`,
      description: company.introduction,
      type: 'article',
      publishedTime: new Date(company.created).toISOString(),
      modifiedTime: new Date(company.created).toISOString(),
      tags: company.alias
    },
    twitter: {
      card: 'summary',
      title: `所属会社为 ${company.name} 的 Galgame`,
      description: company.introduction
    },
    alternates: {
      canonical: `${kunMoyuMoe.domain.main}/company/${company.id}`
    },
    keywords: [company.name, ...company.alias]
  }
}
