import { Container } from '~/components/company/Container'
import { kunGetActions } from './actions'
import { ErrorComponent } from '~/components/error/ErrorComponent'
import { kunMetadata } from './metadata'
import type { Metadata } from 'next'

// 此页数据链 (redis 版本键 → prisma) 不含任何动态 API, 构建期的静态探测渲染会
// 真实打到生产库; 显式声明动态以跳过探测 (运行时本就因 layout session 而动态)
export const dynamic = 'force-dynamic'

export const metadata: Metadata = kunMetadata

export default async function Kun() {
  const response = await kunGetActions({
    page: 1,
    limit: 100
  })
  if (typeof response === 'string') {
    return <ErrorComponent error={response} />
  }

  return (
    <Container
      initialCompanies={response.companies}
      initialTotal={response.total}
    />
  )
}
