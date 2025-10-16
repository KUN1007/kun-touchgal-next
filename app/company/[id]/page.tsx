import { generateKunMetadataTemplate } from './metadata'
import { CompanyDetailContainer } from '~/components/company/detail/Container'
import { kunGetCompanyByIdActions, kunCompanyGalgameActions } from './actions'
import { ErrorComponent } from '~/components/error/ErrorComponent'
import type { Metadata } from 'next'

export const revalidate = 5

interface Props {
  params: Promise<{ id: string }>
}

export const generateMetadata = async ({
  params
}: Props): Promise<Metadata> => {
  const { id } = await params
  const company = await kunGetCompanyByIdActions({ companyId: Number(id) })
  if (typeof company === 'string') {
    return {}
  }
  return generateKunMetadataTemplate(company)
}

export default async function Kun({ params }: Props) {
  const { id } = await params

  const company = await kunGetCompanyByIdActions({ companyId: Number(id) })
  if (typeof company === 'string') {
    return <ErrorComponent error={company} />
  }

  const response = await kunCompanyGalgameActions({
    companyId: Number(id),
    page: 1,
    limit: 24
  })
  if (typeof response === 'string') {
    return <ErrorComponent error={response} />
  }

  return (
    <CompanyDetailContainer
      initialCompany={company}
      initialPatches={response.galgames}
      total={response.total}
    />
  )
}
