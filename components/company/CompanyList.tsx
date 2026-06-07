import { KunMasonry } from '~/components/kun/KunMasonry'
import { KunLoading } from '~/components/kun/Loading'
import { KunNull } from '~/components/kun/Null'
import { CompanyCard } from './Card'
import type { FC } from 'react'
import type { Company as CompanyType } from '~/types/api/company'

interface CompanyListProps {
  companies: CompanyType[]
  loading: boolean
  searching: boolean
}

export const CompanyList: FC<CompanyListProps> = ({
  companies,
  loading,
  searching
}) => {
  if (loading) {
    return <KunLoading hint="正在获取会社数据..." />
  }

  if (!searching && companies.length === 0) {
    return <KunNull message="未找到相关内容, 可能暂未录入哦" />
  }

  return (
    <KunMasonry columnWidth={256} gap={16} estimatedItemHeight={112}>
      {companies.map((company) => (
        <CompanyCard key={company.id} company={company} />
      ))}
    </KunMasonry>
  )
}
